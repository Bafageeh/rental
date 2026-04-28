<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tenants')) {
            Schema::table('tenants', function (Blueprint $table) {
                if (!Schema::hasColumn('tenants', 'identity_type')) {
                    $table->string('identity_type')->nullable();
                }
            });
        }

        if (Schema::hasTable('contracts')) {
            Schema::table('contracts', function (Blueprint $table) {
                if (!Schema::hasColumn('contracts', 'government_contract_number')) {
                    $table->string('government_contract_number')->nullable()->index();
                }
                if (!Schema::hasColumn('contracts', 'ejar_record_number')) {
                    $table->string('ejar_record_number')->nullable()->index();
                }
                if (!Schema::hasColumn('contracts', 'ejar_version_number')) {
                    $table->string('ejar_version_number')->nullable();
                }
                if (!Schema::hasColumn('contracts', 'contract_type')) {
                    $table->string('contract_type')->nullable();
                }
                if (!Schema::hasColumn('contracts', 'sealing_date')) {
                    $table->date('sealing_date')->nullable();
                }
                if (!Schema::hasColumn('contracts', 'sealing_location')) {
                    $table->string('sealing_location')->nullable();
                }
                if (!Schema::hasColumn('contracts', 'parking_fee')) {
                    $table->decimal('parking_fee', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'services_fee')) {
                    $table->decimal('services_fee', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'deposit_amount')) {
                    $table->decimal('deposit_amount', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'brokerage_fee')) {
                    $table->decimal('brokerage_fee', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'brokerage_fee_paid_by')) {
                    $table->string('brokerage_fee_paid_by')->nullable();
                }
                if (!Schema::hasColumn('contracts', 'brokerage_fee_due_date')) {
                    $table->date('brokerage_fee_due_date')->nullable();
                }
                if (!Schema::hasColumn('contracts', 'rent_payments_count')) {
                    $table->unsignedInteger('rent_payments_count')->default(0);
                }
                if (!Schema::hasColumn('contracts', 'regular_payment_amount')) {
                    $table->decimal('regular_payment_amount', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'last_payment_amount')) {
                    $table->decimal('last_payment_amount', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'total_contract_value')) {
                    $table->decimal('total_contract_value', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'electricity_annual_amount')) {
                    $table->decimal('electricity_annual_amount', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'water_annual_amount')) {
                    $table->decimal('water_annual_amount', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'gas_annual_amount')) {
                    $table->decimal('gas_annual_amount', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'parking_annual_amount')) {
                    $table->decimal('parking_annual_amount', 12, 2)->default(0);
                }
                if (!Schema::hasColumn('contracts', 'rented_parking_lots')) {
                    $table->unsignedInteger('rented_parking_lots')->default(0);
                }
                if (!Schema::hasColumn('contracts', 'source')) {
                    $table->string('source')->default('manual');
                }
            });
        }
    }

    public function down(): void
    {
        // Keep imported contract metadata to avoid losing government PDF extraction data.
    }
};
