<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (!Schema::hasColumn('payments', 'sequence')) {
                $table->unsignedInteger('sequence')->nullable()->after('contract_id');
            }

            if (!Schema::hasColumn('payments', 'payment_deadline')) {
                $table->date('payment_deadline')->nullable()->after('due_date');
            }

            if (!Schema::hasColumn('payments', 'due_date_hijri')) {
                $table->string('due_date_hijri', 20)->nullable()->after('payment_deadline');
            }

            if (!Schema::hasColumn('payments', 'payment_deadline_hijri')) {
                $table->string('payment_deadline_hijri', 20)->nullable()->after('due_date_hijri');
            }

            if (!Schema::hasColumn('payments', 'rental_period_days')) {
                $table->unsignedSmallInteger('rental_period_days')->nullable()->after('payment_deadline_hijri');
            }
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            foreach ([
                'rental_period_days',
                'payment_deadline_hijri',
                'due_date_hijri',
                'payment_deadline',
                'sequence',
            ] as $column) {
                if (Schema::hasColumn('payments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
