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
        });
    }

    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            if (Schema::hasColumn('properties', 'property_area')) {
                $table->dropColumn('property_area');
            }

            if (Schema::hasColumn('properties', 'national_short_address')) {
                $table->dropColumn('national_short_address');
            }
        });
    }
};
