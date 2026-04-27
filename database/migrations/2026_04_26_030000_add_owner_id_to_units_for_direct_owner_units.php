<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('units')) {
            return;
        }

        Schema::table('units', function (Blueprint $table) {
            if (!Schema::hasColumn('units', 'owner_id')) {
                $table->unsignedBigInteger('owner_id')->nullable()->after('property_id')->index();
            }

            if (!Schema::hasColumn('units', 'unit_scope')) {
                $table->string('unit_scope')->nullable()->after('owner_id');
            }
        });

        // Fill owner_id for existing units that belong to a property.
        if (Schema::hasTable('properties') && Schema::hasColumn('properties', 'owner_id') && Schema::hasColumn('units', 'property_id') && Schema::hasColumn('units', 'owner_id')) {
            DB::statement("
                UPDATE units
                JOIN properties ON properties.id = units.property_id
                SET units.owner_id = properties.owner_id
                WHERE units.owner_id IS NULL
                  AND units.property_id IS NOT NULL
                  AND properties.owner_id IS NOT NULL
            ");
        }

        if (Schema::hasColumn('units', 'unit_scope') && Schema::hasColumn('units', 'property_id')) {
            DB::table('units')
                ->whereNull('unit_scope')
                ->whereNotNull('property_id')
                ->update(['unit_scope' => 'property']);

            DB::table('units')
                ->whereNull('unit_scope')
                ->whereNull('property_id')
                ->update(['unit_scope' => 'owner']);
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('units')) {
            return;
        }

        Schema::table('units', function (Blueprint $table) {
            if (Schema::hasColumn('units', 'unit_scope')) {
                $table->dropColumn('unit_scope');
            }

            if (Schema::hasColumn('units', 'owner_id')) {
                $table->dropColumn('owner_id');
            }
        });
    }
};
