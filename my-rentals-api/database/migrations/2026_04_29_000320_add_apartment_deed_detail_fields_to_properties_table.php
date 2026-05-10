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

            if (!in_array('deed_property_type_text', $columns, true)) {
                $table->string('deed_property_type_text')->nullable()->after('property_type');
            }
            if (!in_array('deed_usage_text', $columns, true)) {
                $table->string('deed_usage_text')->nullable()->after('deed_property_type_text');
            }
            if (!in_array('deed_unit_number', $columns, true)) {
                $table->string('deed_unit_number')->nullable()->after('deed_usage_text');
            }
            if (!in_array('deed_neighboring_part', $columns, true)) {
                $table->string('deed_neighboring_part')->nullable()->after('deed_unit_number');
            }
            if (!in_array('deed_common_parts_percentage', $columns, true)) {
                $table->string('deed_common_parts_percentage')->nullable()->after('deed_neighboring_part');
            }
            if (!in_array('deed_common_parts_area', $columns, true)) {
                $table->string('deed_common_parts_area')->nullable()->after('deed_common_parts_percentage');
            }
            if (!in_array('deed_unit_land_area', $columns, true)) {
                $table->string('deed_unit_land_area')->nullable()->after('deed_common_parts_area');
            }
            if (!in_array('deed_unit_land_percentage', $columns, true)) {
                $table->string('deed_unit_land_percentage')->nullable()->after('deed_unit_land_area');
            }
            if (!in_array('deed_location_text', $columns, true)) {
                $table->string('deed_location_text')->nullable()->after('deed_unit_land_percentage');
            }
            if (!in_array('deed_property_model', $columns, true)) {
                $table->string('deed_property_model')->nullable()->after('deed_location_text');
            }
            if (!in_array('deed_additional_description', $columns, true)) {
                $table->longText('deed_additional_description')->nullable()->after('deed_property_model');
            }
            if (!in_array('deed_boundaries_description', $columns, true)) {
                $table->longText('deed_boundaries_description')->nullable()->after('deed_additional_description');
            }
        });
    }

    public function down(): void
    {
        // Keep deed details safe.
    }
};
