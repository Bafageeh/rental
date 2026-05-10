<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            if (!Schema::hasColumn('properties', 'national_short_address')) {
                $table->string('national_short_address', 8)->nullable()->after('address');
            }
            if (!Schema::hasColumn('properties', 'property_area')) {
                $table->decimal('property_area', 12, 2)->nullable()->after('national_short_address');
            }
            if (!Schema::hasColumn('properties', 'usage_type')) {
                $table->string('usage_type')->nullable()->after('property_type');
            }
            if (!Schema::hasColumn('properties', 'elevators_count')) {
                $table->unsignedInteger('elevators_count')->default(0)->after('parking_spots_count');
            }
        });

        Schema::table('units', function (Blueprint $table) {
            if (!Schema::hasColumn('units', 'area')) {
                $table->decimal('area', 10, 2)->nullable()->after('floor');
            }
            if (!Schema::hasColumn('units', 'is_furnished')) {
                $table->boolean('is_furnished')->default(false)->after('area');
            }
            if (!Schema::hasColumn('units', 'furnishing_status')) {
                $table->string('furnishing_status')->nullable()->after('is_furnished');
            }
            if (!Schema::hasColumn('units', 'kitchen_cabinets_installed')) {
                $table->boolean('kitchen_cabinets_installed')->default(false)->after('is_kitchen_installed');
            }
            if (!Schema::hasColumn('units', 'ac_units_count')) {
                $table->unsignedInteger('ac_units_count')->default(0)->after('kitchen_cabinets_installed');
            }
            if (!Schema::hasColumn('units', 'electricity_meter_number')) {
                $table->string('electricity_meter_number')->nullable()->after('orientation');
            }
            if (!Schema::hasColumn('units', 'water_meter_number')) {
                $table->string('water_meter_number')->nullable()->after('electricity_meter_number');
            }
            if (!Schema::hasColumn('units', 'gas_meter_number')) {
                $table->string('gas_meter_number')->nullable()->after('water_meter_number');
            }
        });

        Schema::table('contracts', function (Blueprint $table) {
            if (!Schema::hasColumn('contracts', 'sealing_date')) {
                $table->date('sealing_date')->nullable()->after('government_contract_number');
            }
            if (!Schema::hasColumn('contracts', 'sealing_location')) {
                $table->string('sealing_location')->nullable()->after('sealing_date');
            }
            if (!Schema::hasColumn('contracts', 'brokerage_fee')) {
                $table->decimal('brokerage_fee', 12, 2)->default(0)->after('deposit_amount');
            }
            if (!Schema::hasColumn('contracts', 'brokerage_fee_paid_by')) {
                $table->string('brokerage_fee_paid_by')->nullable()->after('brokerage_fee');
            }
            if (!Schema::hasColumn('contracts', 'brokerage_fee_due_date')) {
                $table->date('brokerage_fee_due_date')->nullable()->after('brokerage_fee_paid_by');
            }
            if (!Schema::hasColumn('contracts', 'rent_payments_count')) {
                $table->unsignedInteger('rent_payments_count')->default(0)->after('payment_cycle');
            }
            if (!Schema::hasColumn('contracts', 'regular_payment_amount')) {
                $table->decimal('regular_payment_amount', 12, 2)->default(0)->after('rent_payments_count');
            }
            if (!Schema::hasColumn('contracts', 'last_payment_amount')) {
                $table->decimal('last_payment_amount', 12, 2)->default(0)->after('regular_payment_amount');
            }
            if (!Schema::hasColumn('contracts', 'total_contract_value')) {
                $table->decimal('total_contract_value', 12, 2)->default(0)->after('last_payment_amount');
            }
            if (!Schema::hasColumn('contracts', 'electricity_annual_amount')) {
                $table->decimal('electricity_annual_amount', 12, 2)->default(0)->after('total_contract_value');
            }
            if (!Schema::hasColumn('contracts', 'water_annual_amount')) {
                $table->decimal('water_annual_amount', 12, 2)->default(0)->after('electricity_annual_amount');
            }
            if (!Schema::hasColumn('contracts', 'gas_annual_amount')) {
                $table->decimal('gas_annual_amount', 12, 2)->default(0)->after('water_annual_amount');
            }
            if (!Schema::hasColumn('contracts', 'parking_annual_amount')) {
                $table->decimal('parking_annual_amount', 12, 2)->default(0)->after('gas_annual_amount');
            }
            if (!Schema::hasColumn('contracts', 'rented_parking_lots')) {
                $table->unsignedInteger('rented_parking_lots')->default(0)->after('parking_annual_amount');
            }
        });
    }

    public function down(): void
    {
        //
    }
};
