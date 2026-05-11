<?php

namespace App\Services;

class EnhancedGovernmentContractPdfExtractor extends GovernmentContractPdfExtractor
{
    public function __construct(
        private readonly GovernmentContractPaymentScheduleExtractor $paymentScheduleExtractor
    ) {
    }

    public function extract(string $filePath): array
    {
        $data = parent::extract($filePath);
        $officialPayments = $this->paymentScheduleExtractor->extract($filePath);

        if (!empty($officialPayments)) {
            // اعتمد جدول السداد الرسمي الموجود داخل عقد إيجار بدل توليد التواريخ تقديريًا من بداية العقد.
            $data['payments'] = $officialPayments;
            $data['payments_source'] = 'official_ejar_schedule';
            $data['payments_count_from_schedule'] = count($officialPayments);
        }

        return $data;
    }
}
