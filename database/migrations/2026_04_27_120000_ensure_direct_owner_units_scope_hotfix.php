<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('units')) {
            return;
        }

        $hasPropertyId = Schema::hasColumn('units', 'property_id');
        $hasOwnerId = Schema::hasColumn('units', 'owner_id');
        $hasUnitScope = Schema::hasColumn('units', 'unit_scope');

        Schema::table('units', function (Blueprint $table) use ($hasPropertyId, $hasOwnerId, $hasUnitScope) {
            if (!$hasOwnerId) {
                if ($hasPropertyId) {
                    $table->unsignedBigInteger('owner_id')->nullable()->after('property_id')->index();
                } else {
                    $table->unsignedBigInteger('owner_id')->nullable()->index();
                }
            }

            if (!$hasUnitScope) {
                if ($hasOwnerId || !$hasPropertyId) {
                    $table->string('unit_scope')->nullable()->index();
                } else {
                    $table->string('unit_scope')->nullable()->after('owner_id')->index();
                }
            }
        });

        if (Schema::hasTable('properties') && Schema::hasColumn('properties', 'owner_id') && Schema::hasColumn('units', 'property_id') && Schema::hasColumn('units', 'owner_id')) {
            try {
                DB::statement("\n                    UPDATE units\n                    JOIN properties ON properties.id = units.property_id\n                    SET units.owner_id = properties.owner_id\n                    WHERE (units.owner_id IS NULL OR units.owner_id = 0)\n                      AND units.property_id IS NOT NULL\n                      AND properties.owner_id IS NOT NULL\n                ");
            } catch (Throwable $e) {
                $rows = DB::table('units')->where(function ($q) {
                        $q->whereNull('owner_id')->orWhere('owner_id', 0);
                    })
                    ->whereNotNull('property_id')
                    ->get(['id', 'property_id']);

                foreach ($rows as $row) {
                    $ownerId = DB::table('properties')->where('id', $row->property_id)->value('owner_id');
                    if ($ownerId) {
                        DB::table('units')->where('id', $row->id)->update(['owner_id' => $ownerId]);
                    }
                }
            }
        }

        if (Schema::hasColumn('units', 'unit_scope')) {
            if (Schema::hasColumn('units', 'property_id')) {
                DB::table('units')->whereNull('unit_scope')->whereNotNull('property_id')->update(['unit_scope' => 'property']);
                DB::table('units')->whereNull('unit_scope')->whereNull('property_id')->update(['unit_scope' => 'owner']);
            } else {
                DB::table('units')->whereNull('unit_scope')->update(['unit_scope' => 'owner']);
            }
        }
    }

    public function down(): void
    {
        // Keep the columns. Dropping them would hide direct owner-unit data again.
    }
};
