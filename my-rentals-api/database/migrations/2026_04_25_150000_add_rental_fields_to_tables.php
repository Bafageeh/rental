<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            if (!Schema::hasColumn('properties', 'name')) {
                $table->string('name')->nullable()->after('id');
            }
            if (!Schema::hasColumn('properties', 'city')) {
                $table->string('city')->nullable()->after('name');
            }
            if (!Schema::hasColumn('properties', 'district')) {
                $table->string('district')->nullable()->after('city');
            }
            if (!Schema::hasColumn('properties', 'address')) {
                $table->text('address')->nullable()->after('district');
            }
            if (!Schema::hasColumn('properties', 'notes')) {
                $table->text('notes')->nullable()->after('address');
            }
        });

        Schema::table('units', function (Blueprint $table) {
            if (!Schema::hasColumn('units', 'property_id')) {
                $table->unsignedBigInteger('property_id')->nullable()->after('id');
            }
            if (!Schema::hasColumn('units', 'unit_number')) {
                $table->string('unit_number')->nullable()->after('property_id');
            }
            if (!Schema::hasColumn('units', 'floor')) {
                $table->string('floor')->nullable()->after('unit_number');
            }
            if (!Schema::hasColumn('units', 'type')) {
                $table->string('type')->nullable()->after('floor');
            }
            if (!Schema::hasColumn('units', 'rent_amount')) {
                $table->decimal('rent_amount', 12, 2)->default(0)->after('type');
            }
            if (!Schema::hasColumn('units', 'status')) {
                $table->string('status')->default('available')->after('rent_amount');
            }
        });

        Schema::table('tenants', function (Blueprint $table) {
            if (!Schema::hasColumn('tenants', 'name')) {
                $table->string('name')->nullable()->after('id');
            }
            if (!Schema::hasColumn('tenants', 'phone')) {
                $table->string('phone')->nullable()->after('name');
            }
            if (!Schema::hasColumn('tenants', 'national_id')) {
                $table->string('national_id')->nullable()->after('phone');
            }
            if (!Schema::hasColumn('tenants', 'email')) {
                $table->string('email')->nullable()->after('national_id');
            }
            if (!Schema::hasColumn('tenants', 'notes')) {
                $table->text('notes')->nullable()->after('email');
            }
        });

        Schema::table('contracts', function (Blueprint $table) {
            if (!Schema::hasColumn('contracts', 'unit_id')) {
                $table->unsignedBigInteger('unit_id')->nullable()->after('id');
            }
            if (!Schema::hasColumn('contracts', 'tenant_id')) {
                $table->unsignedBigInteger('tenant_id')->nullable()->after('unit_id');
            }
            if (!Schema::hasColumn('contracts', 'contract_number')) {
                $table->string('contract_number')->nullable()->after('tenant_id');
            }
            if (!Schema::hasColumn('contracts', 'start_date')) {
                $table->date('start_date')->nullable()->after('contract_number');
            }
            if (!Schema::hasColumn('contracts', 'end_date')) {
                $table->date('end_date')->nullable()->after('start_date');
            }
            if (!Schema::hasColumn('contracts', 'rent_amount')) {
                $table->decimal('rent_amount', 12, 2)->default(0)->after('end_date');
            }
            if (!Schema::hasColumn('contracts', 'payment_cycle')) {
                $table->string('payment_cycle')->default('monthly')->after('rent_amount');
            }
            if (!Schema::hasColumn('contracts', 'status')) {
                $table->string('status')->default('active')->after('payment_cycle');
            }
            if (!Schema::hasColumn('contracts', 'notes')) {
                $table->text('notes')->nullable()->after('status');
            }
        });

        Schema::table('payments', function (Blueprint $table) {
            if (!Schema::hasColumn('payments', 'contract_id')) {
                $table->unsignedBigInteger('contract_id')->nullable()->after('id');
            }
            if (!Schema::hasColumn('payments', 'due_date')) {
                $table->date('due_date')->nullable()->after('contract_id');
            }
            if (!Schema::hasColumn('payments', 'paid_date')) {
                $table->date('paid_date')->nullable()->after('due_date');
            }
            if (!Schema::hasColumn('payments', 'amount')) {
                $table->decimal('amount', 12, 2)->default(0)->after('paid_date');
            }
            if (!Schema::hasColumn('payments', 'status')) {
                $table->string('status')->default('due')->after('amount');
            }
            if (!Schema::hasColumn('payments', 'notes')) {
                $table->text('notes')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        //
    }
};
