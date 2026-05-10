<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;

class GovernmentContractImporter
{
    public function import(array $data, ?Owner $forcedOwner = null, ?Property $forcedProperty = null, ?Unit $forcedUnit = null): array
    {
        $lessor = $data['lessor'] ?? [];
        $tenantData = $data['tenant'] ?? [];
        $ownership = $data['ownership'] ?? [];
        $propertyData = $data['property'] ?? [];
        $unitData = $data['unit'] ?? [];
        $contractData = $data['contract'] ?? [];
        $financial = $data['financial'] ?? [];
        $payments = $data['payments'] ?? [];

        $owner = $this->resolveOwner($lessor, $forcedOwner, $forcedProperty, $forcedUnit);
        $tenant = $this->upsertTenant($tenantData);
        $property = $this->resolveProperty($owner, $ownership, $propertyData, $forcedProperty, $forcedUnit);
        $unit = $this->resolveUnit($owner, $property, $unitData, $financial, $forcedUnit);
        $contract = $this->upsertContract($unit, $tenant, $contractData, $financial);

        $this->storePayments($contract, $payments, $financial, $contractData);

        return [
            'owner' => $owner->fresh(),
            'tenant' => $tenant->fresh(),
            'property' => $property ? $property->fresh() : null,
            'unit' => $unit->fresh(['property.owner']),
            'contract' => $contract->fresh(['tenant', 'unit.property.owner', 'payments']),
            'payments_count' => count($payments) ?: (int) ($financial['rent_payments_count'] ?? 0),
        ];
    }

    private function resolveOwner(array $lessor, ?Owner $forcedOwner, ?Property $forcedProperty, ?Unit $forcedUnit): Owner
    {
        if ($forcedOwner) {
            return $forcedOwner;
        }

        if ($forcedUnit && $forcedUnit->property && $forcedUnit->property->owner) {
            return $forcedUnit->property->owner;
        }

        if ($forcedUnit && Schema::hasColumn('units', 'owner_id') && $forcedUnit->owner_id) {
            $owner = Owner::find($forcedUnit->owner_id);
            if ($owner) {
                return $owner;
            }
        }

        if ($forcedProperty && $forcedProperty->owner) {
            return $forcedProperty->owner;
        }

        $nationalId = $lessor['national_id'] ?? null;
        if ($nationalId) {
            $owner = Owner::where('national_id', $nationalId)->first();

            if ($owner) {
                $updates = [];

                if (!empty($lessor['phone'])) {
                    $updates['phone'] = $lessor['phone'];
                }

                if (!empty($lessor['email'])) {
                    $updates['email'] = $lessor['email'];
                }

                if (empty($owner->type)) {
                    $updates['type'] = 'external';
                }

                if (!empty($updates)) {
                    $owner->fill($updates);
                    $owner->save();
                }

                return $owner;
            }

            return Owner::create([
                'name' => $lessor['name'] ?? 'مالك غير محدد',
                'phone' => $lessor['phone'] ?? null,
                'email' => $lessor['email'] ?? null,
                'national_id' => $nationalId,
                'type' => 'external',
            ]);
        }

        return Owner::firstOrCreate(
            ['name' => $lessor['name'] ?? 'مالك غير محدد'],
            [
                'phone' => $lessor['phone'] ?? null,
                'email' => $lessor['email'] ?? null,
                'type' => 'external',
            ]
        );
    }

    private function upsertTenant(array $tenantData): Tenant
    {
        $nationalId = $tenantData['national_id'] ?? null;
        $identityType = $tenantData['identity_type'] ?? $tenantData['id_type'] ?? null;

        $payload = [
            'name' => $tenantData['name'] ?? 'مستأجر غير محدد',
            'phone' => $tenantData['phone'] ?? null,
            'email' => $tenantData['email'] ?? null,
            'national_id' => $nationalId,
            'nationality' => $tenantData['nationality'] ?? null,
        ];

        if (Schema::hasColumn('tenants', 'identity_type')) {
            $payload['identity_type'] = $identityType;
        }

        if ($nationalId) {
            return Tenant::updateOrCreate(['national_id' => $nationalId], $payload);
        }

        return Tenant::firstOrCreate(['name' => $payload['name']], $payload);
    }

    private function resolveProperty(Owner $owner, array $ownership, array $propertyData, ?Property $forcedProperty, ?Unit $forcedUnit): ?Property
    {
        if ($forcedUnit && $forcedUnit->property) {
            $property = $forcedUnit->property;
            $this->updatePropertyFromPdf($property, $owner, $ownership, $propertyData);
            return $property;
        }

        if ($forcedProperty) {
            $this->updatePropertyFromPdf($forcedProperty, $owner, $ownership, $propertyData);
            return $forcedProperty;
        }

        $propertyAddress = $propertyData['address'] ?? null;
        $propertyName = $propertyAddress ? 'عقار ' . mb_substr($propertyAddress, 0, 35) : 'عقار مستورد من عقد إيجار';
        $deedNumber = $ownership['deed_number'] ?? null;

        $keys = ['owner_id' => $owner->id];
        if ($deedNumber) {
            $keys['deed_number'] = $deedNumber;
        } else {
            $keys['name'] = $propertyName;
        }

        return Property::updateOrCreate($keys, $this->propertyPayload($owner, $ownership, $propertyData, $propertyName));
    }

    private function updatePropertyFromPdf(Property $property, Owner $owner, array $ownership, array $propertyData): void
    {
        $payload = $this->propertyPayload($owner, $ownership, $propertyData, $property->name ?: 'عقار مستورد من عقد إيجار');
        unset($payload['name']);

        $property->fill(array_filter($payload, fn ($value) => $value !== null && $value !== ''));
        $property->save();
    }

    private function propertyPayload(Owner $owner, array $ownership, array $propertyData, string $name): array
    {
        return [
            'owner_id' => $owner->id,
            'name' => $name,
            'deed_number' => $ownership['deed_number'] ?? null,
            'address' => $propertyData['address'] ?? null,
            'property_type' => $propertyData['property_type'] ?? 'building',
            'usage_type' => $propertyData['usage_type'] ?? null,
            'floors_count' => $propertyData['floors_count'] ?? 0,
            'parking_spots_count' => $propertyData['parking_spots_count'] ?? 0,
            'elevators_count' => $propertyData['elevators_count'] ?? 0,
            'management_type' => 'managed',
        ];
    }

    private function resolveUnit(Owner $owner, ?Property $property, array $unitData, array $financial, ?Unit $forcedUnit): Unit
    {
        $payload = [
            'property_id' => $property?->id,
            'unit_number' => $unitData['unit_number'] ?? null,
            'floor' => $unitData['floor'] ?? null,
            'type' => $unitData['type'] ?? null,
            'area' => $unitData['area'] ?? null,
            'rooms_count' => $unitData['rooms_count'] ?? 0,
            'has_living_room' => $unitData['has_living_room'] ?? false,
            'has_kitchen' => $unitData['has_kitchen'] ?? false,
            'ac_units_count' => $unitData['ac_units_count'] ?? 0,
            'electricity_meter_number' => $unitData['electricity_meter_number'] ?? null,
            'water_meter_number' => $unitData['water_meter_number'] ?? null,
            'gas_meter_number' => $unitData['gas_meter_number'] ?? null,
            'rent_amount' => $financial['rent_amount'] ?? 0,
            'status' => 'rented',
        ];

        if (Schema::hasColumn('units', 'owner_id')) {
            $payload['owner_id'] = $owner->id;
        }
        if (Schema::hasColumn('units', 'unit_scope')) {
            $payload['unit_scope'] = $property ? 'property' : 'owner';
        }

        if ($forcedUnit) {
            // مهم جدًا: عند رفع عقد PDF لوحدة محددة من الشاشة، لا نسمح للاستخراج بتغيير هوية الوحدة.
            // لا تغيّر رقم الوحدة مثل شقة 9 إلى رقم قرأه الـ PDF، ولا تنقلها لعقار/مالك آخر.
            // يتم تحديث بيانات وصفية آمنة فقط، ثم العقد يربط بنفس forcedUnit.id.
            $safePayload = $payload;
            unset(
                $safePayload['property_id'],
                $safePayload['owner_id'],
                $safePayload['unit_scope'],
                $safePayload['unit_number'],
                $safePayload['floor']
            );

            $forcedUnit->fill(array_filter($safePayload, fn ($value) => $value !== null && $value !== ''));
            $forcedUnit->save();
            return $forcedUnit;
        }

        $keys = ['property_id' => $property?->id, 'unit_number' => $unitData['unit_number'] ?? null];

        if (!$keys['unit_number']) {
            $keys['unit_number'] = 'وحدة مستوردة ' . now()->format('YmdHis');
            $payload['unit_number'] = $keys['unit_number'];
        }

        return Unit::updateOrCreate($keys, $payload);
    }

    private function upsertContract(Unit $unit, Tenant $tenant, array $contractData, array $financial): Contract
    {
        $recordNumber = $contractData['ejar_record_number'] ?? $contractData['government_contract_number'] ?? null;
        $versionNumber = $contractData['ejar_version_number'] ?? null;
        $displayNumber = $contractData['contract_number'] ?? ($recordNumber && $versionNumber ? $recordNumber . ' / ' . $versionNumber : $recordNumber);
        $startDate = $contractData['start_date'] ? Carbon::parse($contractData['start_date'])->toDateString() : null;
        $endDate = $contractData['end_date'] ? Carbon::parse($contractData['end_date'])->toDateString() : null;
        $status = $endDate && Carbon::parse($endDate)->lt(today()) ? 'ended' : 'active';

        $payload = [
            'unit_id' => $unit->id,
            'tenant_id' => $tenant->id,
            'contract_number' => $displayNumber,
            'government_contract_number' => $recordNumber,
            'ejar_record_number' => $recordNumber,
            'ejar_version_number' => $versionNumber,
            'contract_type' => $contractData['contract_type'] ?? null,
            'sealing_date' => $contractData['sealing_date'] ?? null,
            'sealing_location' => $contractData['sealing_location'] ?? null,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'rent_amount' => $financial['rent_amount'] ?? 0,
            'parking_fee' => $financial['parking_annual_amount'] ?? 0,
            'services_fee' => 0,
            'deposit_amount' => $financial['deposit_amount'] ?? 0,
            'brokerage_fee' => $financial['brokerage_fee'] ?? 0,
            'brokerage_fee_due_date' => $contractData['brokerage_fee_due_date'] ?? $financial['brokerage_fee_due_date'] ?? null,
            'payment_cycle' => $financial['payment_cycle'] ?? 'monthly',
            'rent_payments_count' => $financial['rent_payments_count'] ?? 0,
            'regular_payment_amount' => $financial['regular_payment_amount'] ?? 0,
            'last_payment_amount' => $financial['last_payment_amount'] ?? 0,
            'total_contract_value' => $financial['total_contract_value'] ?? ($financial['rent_amount'] ?? 0),
            'electricity_annual_amount' => $financial['electricity_annual_amount'] ?? 0,
            'water_annual_amount' => $financial['water_annual_amount'] ?? 0,
            'gas_annual_amount' => $financial['gas_annual_amount'] ?? 0,
            'parking_annual_amount' => $financial['parking_annual_amount'] ?? 0,
            'rented_parking_lots' => $financial['rented_parking_lots'] ?? 0,
            'status' => $status,
            'source' => 'government_pdf',
        ];

        $payload = $this->onlyExistingColumns('contracts', $payload);

        if ($startDate && $endDate) {
            $existingSameIdentityAndDates = $this->findMatchingIdentityAndDates($unit, $tenant, $startDate, $endDate);

            if ($existingSameIdentityAndDates) {
                $existingSameIdentityAndDates->fill($payload);
                $existingSameIdentityAndDates->save();
                $this->syncUnitStatus($unit, $status, $financial['rent_amount'] ?? null);
                return $existingSameIdentityAndDates;
            }

            $this->abortIfOverlappingPeriod($unit, $startDate, $endDate);
        }

        $contract = new Contract($payload);
        $contract->save();
        $this->syncUnitStatus($unit, $status, $financial['rent_amount'] ?? null);
        return $contract;
    }

    private function findMatchingIdentityAndDates(Unit $unit, Tenant $tenant, string $startDate, string $endDate): ?Contract
    {
        $tenantNationalId = trim((string) ($tenant->national_id ?? ''));

        return Contract::where('unit_id', $unit->id)
            ->whereDate('start_date', $startDate)
            ->whereDate('end_date', $endDate)
            ->whereHas('tenant', function ($query) use ($tenant, $tenantNationalId) {
                if ($tenantNationalId !== '') {
                    $query->where('national_id', $tenantNationalId);
                } else {
                    $query->where('id', $tenant->id);
                }
            })
            ->first();
    }

    private function abortIfOverlappingPeriod(Unit $unit, string $startDate, string $endDate): void
    {
        $overlap = Contract::where('unit_id', $unit->id)
            ->whereDate('start_date', '<=', $endDate)
            ->whereDate('end_date', '>=', $startDate)
            ->first();

        if (!$overlap) {
            return;
        }

        abort(response()->json([
            'status' => 'error',
            'message' => 'لا يمكن حفظ العقد؛ توجد فترة عقد أخرى متداخلة على نفس الوحدة. يسمح بعقود تاريخية متعددة فقط إذا لم تتداخل التواريخ.',
            'existing_contract_id' => $overlap->id,
            'existing_start_date' => $overlap->start_date,
            'existing_end_date' => $overlap->end_date,
        ], 422));
    }

    private function syncUnitStatus(Unit $unit, string $contractStatus, $rentAmount = null): void
    {
        $unit->status = $contractStatus === 'active' ? 'rented' : 'available';

        if ($contractStatus === 'active' && $rentAmount !== null) {
            $unit->rent_amount = $rentAmount;
        }

        $unit->save();
    }

    private function storePayments(Contract $contract, array $payments, array $financial, array $contractData): void
    {
        if (empty($payments)) {
            $payments = $this->generatePayments($financial, $contractData);
        }

        foreach ($payments as $payment) {
            Payment::updateOrCreate(
                [
                    'contract_id' => $contract->id,
                    'due_date' => $payment['due_date'] ?? null,
                ],
                [
                    'contract_id' => $contract->id,
                    'due_date' => $payment['due_date'] ?? null,
                    'amount' => $payment['amount'] ?? 0,
                    'status' => 'due',
                    'notes' => isset($payment['payment_deadline'])
                        ? 'نهاية مهلة السداد: ' . $payment['payment_deadline']
                        : 'دفعة مستوردة من عقد إيجار',
                ]
            );
        }
    }

    private function generatePayments(array $financial, array $contractData): array
    {
        $count = (int) ($financial['rent_payments_count'] ?? 0);
        $amount = (float) ($financial['regular_payment_amount'] ?? 0);
        $lastAmount = (float) ($financial['last_payment_amount'] ?? $amount);
        $startDate = $contractData['start_date'] ?? null;
        $cycle = $financial['payment_cycle'] ?? 'monthly';

        if ($count <= 0 || !$startDate || ($amount <= 0 && $lastAmount <= 0)) {
            return [];
        }

        $start = Carbon::parse($startDate);
        $payments = [];

        for ($i = 0; $i < $count; $i++) {
            $date = $start->copy();
            if ($cycle === 'quarterly') {
                $date->addMonthsNoOverflow($i * 3);
            } elseif ($cycle === 'semi_annual') {
                $date->addMonthsNoOverflow($i * 6);
            } elseif ($cycle === 'annual') {
                $date->addYears($i);
            } else {
                $date->addMonthsNoOverflow($i);
            }

            $payments[] = [
                'sequence' => $i + 1,
                'due_date' => $date->toDateString(),
                'amount' => $i === $count - 1 ? ($lastAmount ?: $amount) : $amount,
            ];
        }

        return $payments;
    }

    private function onlyExistingColumns(string $table, array $payload): array
    {
        return array_filter(
            $payload,
            fn ($value, $key) => Schema::hasColumn($table, $key),
            ARRAY_FILTER_USE_BOTH
        );
    }
}
