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

            if (!in_array('deed_mortgage_status', $columns, true)) {
                $table->string('deed_mortgage_status')->nullable()->after('deed_boundaries_description');
            }
            if (!in_array('deed_mortgagee_name', $columns, true)) {
                $table->string('deed_mortgagee_name')->nullable()->after('deed_mortgage_status');
            }
            if (!in_array('deed_mortgagee_entity_number', $columns, true)) {
                $table->string('deed_mortgagee_entity_number')->nullable()->after('deed_mortgagee_name');
            }
            if (!in_array('deed_mortgage_amount', $columns, true)) {
                $table->decimal('deed_mortgage_amount', 15, 2)->nullable()->after('deed_mortgagee_entity_number');
            }
            if (!in_array('deed_mortgage_due_date', $columns, true)) {
                $table->string('deed_mortgage_due_date')->nullable()->after('deed_mortgage_amount');
            }
            if (!in_array('deed_mortgage_notes', $columns, true)) {
                $table->longText('deed_mortgage_notes')->nullable()->after('deed_mortgage_due_date');
            }

            foreach (['north', 'south', 'east', 'west'] as $side) {
                if (!in_array("deed_{$side}_boundary_type", $columns, true)) {
                    $table->string("deed_{$side}_boundary_type")->nullable()->after('deed_mortgage_notes');
                }
                if (!in_array("deed_{$side}_boundary_description", $columns, true)) {
                    $table->string("deed_{$side}_boundary_description")->nullable()->after("deed_{$side}_boundary_type");
                }
                if (!in_array("deed_{$side}_boundary_length", $columns, true)) {
                    $table->decimal("deed_{$side}_boundary_length", 10, 2)->nullable()->after("deed_{$side}_boundary_description");
                }
            }
        });
    }

    public function down(): void
    {
        // Keep extracted deed data safe.
    }
};
