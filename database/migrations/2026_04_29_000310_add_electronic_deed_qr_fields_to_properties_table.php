<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $columns = Schema::getColumnListing('properties');

            if (!in_array('real_estate_identity_map_url', $columns, true)) {
                $table->text('real_estate_identity_map_url')->nullable()->after('real_estate_identity_number');
            }

            if (!in_array('location_access_url', $columns, true)) {
                $table->text('location_access_url')->nullable()->after('real_estate_identity_map_url');
            }

            if (!in_array('property_latitude', $columns, true)) {
                $table->decimal('property_latitude', 12, 8)->nullable()->after('location_access_url');
            }

            if (!in_array('property_longitude', $columns, true)) {
                $table->decimal('property_longitude', 12, 8)->nullable()->after('property_latitude');
            }
        });
    }

    public function down(): void
    {
        // Intentionally left empty to keep deed QR data safe.
    }
};
