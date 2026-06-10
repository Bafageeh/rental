<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'owners',
            'properties',
            'units',
            'tenants',
            'contracts',
            'payments',
            'property_expenses',
            'parking_spots',
            'contract_files',
            'property_files',
            'unit_media',
            'owner_transfers',
            'owner_settlements',
            'owner_bank_accounts',
            'chat_threads',
            'chat_messages',
            'users',
        ] as $tableName) {
            if (Schema::hasTable($tableName) && !Schema::hasColumn($tableName, 'manager_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->unsignedBigInteger('manager_id')->nullable()->index();
                });
            }
        }
    }

    public function down(): void
    {
        foreach ([
            'owners',
            'properties',
            'units',
            'tenants',
            'contracts',
            'payments',
            'property_expenses',
            'parking_spots',
            'contract_files',
            'property_files',
            'unit_media',
            'owner_transfers',
            'owner_settlements',
            'owner_bank_accounts',
            'chat_threads',
            'chat_messages',
            'users',
        ] as $tableName) {
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'manager_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropColumn('manager_id');
                });
            }
        }
    }
};
