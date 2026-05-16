<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('property_expenses')) {
            return;
        }

        Schema::table('property_expenses', function (Blueprint $table) {
            if (!Schema::hasColumn('property_expenses', 'unit_id')) {
                $table->foreignId('unit_id')
                    ->nullable()
                    ->after('property_id')
                    ->constrained('units')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('property_expenses') || !Schema::hasColumn('property_expenses', 'unit_id')) {
            return;
        }

        Schema::table('property_expenses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('unit_id');
        });
    }
};
