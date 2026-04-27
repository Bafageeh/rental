<?php

namespace App\Services;

use Smalot\PdfParser\Parser;

class GovernmentContractPdfExtractor
{
    public function extract(string $filePath): array
    {
        $parser = new Parser();
        $pdf = $parser->parseFile($filePath);

        $rawText = $pdf->getText();
        $text = $this->normalize($rawText);

        $lessorBlock = $this->between($text, 'Data Lessor', 'Data Representative Lessor');
        $tenantBlock = $this->between($text, 'Data Tenant', 'Data Representative Tenant');
        $ownershipBlock = $this->between($text, 'Data document Ownership', 'Data Property');
        $propertyBlock = $this->between($text, 'Data Property', 'Data Units Rental');
        $unitBlock = $this->between($text, 'Data Units Rental', 'Authority Tenant');
        $financialBlock = $this->between($text, 'Data Financial', 'Schedule Payments Rent');

        $payments = $this->extractPaymentSchedule($rawText);

        $rooms = $this->extractRooms($unitBlock);

        return [
            'contract' => [
                'contract_number' => $this->match('/رقم سجل العقد:\s*([0-9\-]+)\s*\/\s*(\d+)/u', $text, 1),
                'government_contract_number' => $this->match('/رقم سجل العقد:\s*([0-9\-]+)\s*\/\s*(\d+)/u', $text, 2),
                'contract_type' => $this->match('/نوع العقد:\s*([^\s]+)\s*Type Contract/u', $text, 1),
                'sealing_date' => $this->match('/تاريخ إبرام العقد:\s*(\d{4}-\d{2}-\d{2})/u', $text, 1),
                'sealing_location' => $this->match('/مكان إبرام العقد:\s*([^\s]+)/u', $text, 1),
                'start_date' => $this->match('/تاريخ بداية.*?الإيجار:\s*(\d{4}-\d{2}-\d{2})/u', $text, 1),
                'end_date' => $this->match('/تاريخ نهاية.*?الإيجار:\s*(\d{4}-\d{2}-\d{2})/u', $text, 1),
            ],

            'lessor' => $this->extractPerson($lessorBlock),

            'tenant' => $this->extractPerson($tenantBlock),

            'ownership' => [
                'deed_number' => $this->match('/رقم المستند:\s*([0-9]+)/u', $ownershipBlock, 1),
                'issuer' => $this->match('/جهة الإصدار:\s*([^:]+?)\s*:Issuer/u', $ownershipBlock, 1),
                'issue_date' => $this->match('/Issue Date:\s*(\d{4}-\d{2}-\d{2})/u', $ownershipBlock, 1),
                'deed_type' => $this->match('/نوع الصك:\s*(.*?)\s*:type deed Title/u', $ownershipBlock, 1),
            ],

            'property' => [
                'address' => $this->match('/العنوان الوطني:\s*(.*?)\s*Address National/u', $propertyBlock, 1),
                'property_type' => $this->match('/نوع بناء العقار:\s*(.*?)\s*Type Property/u', $propertyBlock, 1),
                'usage_type' => $this->match('/الغرض من استخدام العقار:\s*(.*?)\s*Usage Property/u', $propertyBlock, 1),
                'units_count' => $this->toInt($this->match('/Number of Units\s*(\d+)/u', $propertyBlock, 1)),
                'floors_count' => $this->toInt($this->match('/Number of Floors\s*(\d+)/u', $propertyBlock, 1)),
                'parking_spots_count' => $this->toInt($this->match('/Number of Parking Lots\s*(\d+)/u', $propertyBlock, 1)),
                'elevators_count' => $this->toInt($this->match('/Number of Elevators\s*(\d+)/u', $propertyBlock, 1)),
            ],

            'unit' => [
                'type' => $this->match('/نوع الوحدة:\s*(.*?)\s*Type Unit/u', $unitBlock, 1),
                'unit_number' => $this->match('/رقم الوحدة:\s*([^\s]+)\s*\.?No Unit/u', $unitBlock, 1),
                'floor' => $this->match('/رقم الطابق:\s*([^\s]+)\s*\.?No Floor/u', $unitBlock, 1),
                'area' => $this->toFloat($this->match('/مساحة الوحدة:\s*([\d.]+)/u', $unitBlock, 1)),
                'rooms_count' => $rooms['bedrooms'] ?? 0,
                'has_living_room' => (($rooms['living_rooms'] ?? 0) > 0),
                'has_kitchen' => (($rooms['kitchens'] ?? 0) > 0),
                'electricity_meter_number' => $this->match('/رقم ع.*?داد الكهرباء\s*([A-Za-z0-9]+)/u', $unitBlock, 1),
                'water_meter_number' => $this->match('/رقم ع.*?داد المياه\s*([A-Za-z0-9\-]+)/u', $unitBlock, 1),
                'gas_meter_number' => $this->match('/رقم ع.*?داد الغاز\s*([A-Za-z0-9\-]+)/u', $unitBlock, 1),
                'ac_units_count' => $this->toInt($this->match('/عدد وحدات التكييف\s*(\d+)/u', $unitBlock, 1)),
            ],

            'financial' => [
                'brokerage_fee' => $this->toFloat($this->match('/أجرة.*?السعي.*?:\s*([\d.]+)/u', $financialBlock, 1)),
                'brokerage_fee_due_date' => $this->match('/تاريخ استحقاق أجرة السعي:\s*(\d{4}-\d{2}-\d{2})/u', $financialBlock, 1),
                'deposit_amount' => $this->toFloat($this->match('/مبلغ.*?الضمان.*?:\s*([\d.]+)/u', $financialBlock, 1)),
                'gas_annual_amount' => $this->toFloat($this->match('/Gas Annual Amount\s*([\d.]+)/u', $financialBlock, 1)),
                'electricity_annual_amount' => $this->toFloat($this->match('/Electricity Annual Amount\s*.*?([\d.]+)/u', $financialBlock, 1)),
                'parking_annual_amount' => $this->toFloat($this->match('/Parking Annual Amount\s*([\d.]+)/u', $financialBlock, 1)),
                'water_annual_amount' => $this->toFloat($this->match('/Water Annual Amount\s*([\d.]+)/u', $financialBlock, 1)),
                'rent_amount' => $this->toFloat($this->match('/قيمة الإيجار\s*([\d.]+)\s*Rent Annual/u', $financialBlock, 1)),
                'rented_parking_lots' => $this->toInt($this->match('/عدد المواقف المستأجرة:\s*(\d+)/u', $financialBlock, 1)),
                'regular_payment_amount' => $this->toFloat($this->match('/دفعة الإيجار.*?الدورية:\s*([\d.]+)/u', $financialBlock, 1)),
                'payment_cycle' => $this->match('/دورة سداد.*?الايجار\s*([^\s]+)\s*cycle payment Rent/u', $financialBlock, 1),
                'rent_payments_count' => $this->toInt($this->match('/عدد دفعات الإيجار:\s*(\d+)/u', $financialBlock, 1)),
                'last_payment_amount' => $this->toFloat($this->match('/دفعة الإيجار الأخيرة:\s*([\d.]+)/u', $financialBlock, 1)),
                'total_contract_value' => $this->toFloat($this->match('/اجمالي قيمة العقد:\s*([\d.]+)/u', $financialBlock, 1)),
            ],

            'payments' => $payments,

            'raw_text_excerpt' => mb_substr($text, 0, 3000),
        ];
    }

    private function normalize(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[ \t]+/u', ' ', $text);
        return trim($text);
    }

    private function between(string $text, string $start, string $end): string
    {
        $startPos = mb_strpos($text, $start);
        if ($startPos === false) {
            return '';
        }

        $startPos += mb_strlen($start);
        $endPos = mb_strpos($text, $end, $startPos);

        if ($endPos === false) {
            return mb_substr($text, $startPos);
        }

        return mb_substr($text, $startPos, $endPos - $startPos);
    }

    private function match(string $pattern, string $text, int $group = 1): ?string
    {
        if (preg_match($pattern, $text, $matches)) {
            $value = trim($matches[$group] ?? '');
            return $value === '-' || $value === '' ? null : $value;
        }

        return null;
    }

    private function extractPerson(string $block): array
    {
        return [
            'name' => $this->match('/(?:االسم|الاسم):\s*(.*?)\s*Name/u', $block, 1),
            'nationality' => $this->match('/Nationality\s*(.*?)\s*الجنس/u', $block, 1),
            'id_type' => $this->match('/نوع الهو.*?ية:\s*(.*?)\s*Type ID/u', $block, 1),
            'national_id' => $this->match('/رقم الهو.*?ية:\s*(\d+)/u', $block, 1),
            'phone' => $this->match('/Mobile\s+No\.\s*([+\d]+)/iu', $block, 1)
                ?? $this->match('/رقم الج.*?وال:\s*([+\d]+)/u', $block, 1),
            'email' => $this->match('/([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/iu', $block, 1),
        ];
    }

    private function extractRooms(string $unitBlock): array
    {
        $result = [
            'living_rooms' => 0,
            'kitchens' => 0,
            'bedrooms' => 0,
            'raw' => [],
        ];

        if (preg_match_all('/نوع الغرفة\s*(.*?)\s*Type Room\s*العدد\s*(\d+)/u', $unitBlock, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $type = trim($match[1]);
                $count = (int) $match[2];

                $result['raw'][] = [
                    'type' => $type,
                    'count' => $count,
                ];

                if (str_contains($type, 'صا')) {
                    $result['living_rooms'] += $count;
                } elseif (str_contains($type, 'مطبخ')) {
                    $result['kitchens'] += $count;
                } elseif (str_contains($type, 'نوم')) {
                    $result['bedrooms'] += $count;
                }
            }
        }

        return $result;
    }

    private function extractPaymentSchedule(string $rawText): array
    {
        $payments = [];

        if (preg_match_all('/^\s*(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+.*?\s+([\d.]+)\s*$/mu', $rawText, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $payments[] = [
                    'sequence' => (int) $match[1],
                    'due_date' => $match[2],
                    'payment_deadline' => $match[3],
                    'amount' => $this->toFloat($match[4]),
                ];
            }
        }

        return $payments;
    }

    private function toFloat(?string $value): float
    {
        if (!$value) {
            return 0;
        }

        return (float) str_replace(',', '', $value);
    }

    private function toInt(?string $value): int
    {
        if (!$value) {
            return 0;
        }

        return (int) preg_replace('/\D+/', '', $value);
    }
}
