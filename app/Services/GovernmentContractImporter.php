<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;

class GovernmentContractImporter
{
    public function import(array $data, ?Owner $forcedOwner = null): array
    {
        $lessor = $data['lessor'] ?? [];
        $tenantData = $data['tenant'] ?? [];
        $ownership = $data['ownership'] ?? [];
        $propertyData = $data['property'] ?? [];
        $unitData = $data['unit'] ?? [];
        $contractData = $data['contract'] ?? [];
        $financial = $data['financial'] ?? [];
        $payments = $data['payments'] ?? [];

        $owner = $forcedOwner ?: Owner::updateOrCreate(
            ['national_id' => $lessor['national_id'] ?? null],
            [
                'name' => $lessor['name'] ?? 'مالك غير محدد',
                'phone' => $lessor['phone'] ?? null,
                'email' => $lessor['email'] ?? null,
                'national_id' => $lessor['national_id'] ?? null,
                'type' => 'external',
            ]
        );

        $tenant = Tenant::updateOrCreate(
            ['national_id' => $tenantData['national_id'] ?? null],
            [
                'name' => $tenantData['name'] ?? 'مستأجر غير محدد',
                'phone' => $tenantData['phone'] ?? null,
                'email' => $tenantData['email'] ?? null,
                'national_id' => $tenantData['national_id'] ?? null,
                'nationality' => $tenantData['nationality'] ?? null,
            ]
        );

        $propertyAddress = $propertyData['address'] ?? null;
        $propertyShortAddress = $propertyData['national_short_address'] ?? null;
        $propertyName = $propertyShortAddress ?: $propertyAddress;
        $propertyName = $propertyName ? 'عقار ' . mb_substr($propertyName, 0, 35) : 'عقار مستورد من عقد حكومي';

        $property = Property::updateOrCreate(
            [
                'owner_id' => $owner->id,
                'deed_number' => $ownership['deed_number'] ?? null,
            ],
            [
                'owner_id' => $owner->id,
                'name' => $propertyName,
                'deed_number' => $ownership['deed_number'] ?? null,
                'address' => $propertyAddress,
                'national_short_address' => $propertyShortAddress,
                'property_type' => $propertyData['property_type'] ?? 'building',
                'usage_type' => $propertyData['usage_type'] ?? null,
                'floors_count' => $propertyData['floors_count'] ?? 0,
                'parking_spots_count' => $propertyData['parking_spots_count'] ?? 0,
                'elevators_count' => $propertyData['elevators_count'] ?? 0,
                'management_type' => 'managed',
            ]
        );

        $unit = Unit::updateOrCreate(
            [
                'property_id' => $property->id,
                'unit_number' => $unitData['unit_number'] ?? null,
            ],
            [
                'property_id' => $property->id,
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
            ]
        );

        $contract = Contract::updateOrCreate(
            [
                'government_contract_number' => $contractData['government_contract_number'] ?? null,
            ],
            [
                'unit_id' => $unit->id,
                'tenant_id' => $tenant->id,
                'contract_number' => $contractData['contract_number'] ?? null,
                'government_contract_number' => $contractData['government_contract_number'] ?? null,
                'sealing_date' => $contractData['sealing_date'] ?? null,
                'sealing_location' => $contractData['sealing_location'] ?? null,
                'start_date' => $contractData['start_date'] ?? null,
                'end_date' => $contractData['end_date'] ?? null,
                'rent_amount' => $financial['rent_amount'] ?? 0,
                'parking_fee' => $financial['parking_annual_amount'] ?? 0,
                'services_fee' => 0,
                'deposit_amount' => $financial['deposit_amount'] ?? 0,
                'brokerage_fee' => $financial['brokerage_fee'] ?? 0,
                'brokerage_fee_due_date' => $financial['brokerage_fee_due_date'] ?? null,
                'payment_cycle' => $financial['payment_cycle'] ?? 'unknown',
                'rent_payments_count' => $financial['rent_payments_count'] ?? 0,
                'regular_payment_amount' => $financial['regular_payment_amount'] ?? 0,
                'last_payment_amount' => $financial['last_payment_amount'] ?? 0,
                'total_contract_value' => $financial['total_contract_value'] ?? 0,
                'electricity_annual_amount' => $financial['electricity_annual_amount'] ?? 0,
                'water_annual_amount' => $financial['water_annual_amount'] ?? 0,
                'gas_annual_amount' => $financial['gas_annual_amount'] ?? 0,
                'parking_annual_amount' => $financial['parking_annual_amount'] ?? 0,
                'rented_parking_lots' => $financial['rented_parking_lots'] ?? 0,
                'status' => 'active',
                'source' => 'government_pdf',
            ]
        );

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
                        : null,
                ]
            );
        }

        return [
            'owner' => $owner,
            'tenant' => $tenant,
            'property' => $property,
            'unit' => $unit,
            'contract' => $contract,
            'payments_count' => count($payments),
        ];
    }
}
