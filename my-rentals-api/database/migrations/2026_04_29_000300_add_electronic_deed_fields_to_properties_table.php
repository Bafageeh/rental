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

            if (!in_array('document_number', $columns, true)) $table->string('document_number')->nullable()->after('deed_number');
            if (!in_array('document_date_hijri', $columns, true)) $table->string('document_date_hijri', 50)->nullable()->after('document_number');
            if (!in_array('document_date_gregorian', $columns, true)) $table->date('document_date_gregorian')->nullable()->after('document_date_hijri');
            if (!in_array('document_status', $columns, true)) $table->string('document_status')->nullable()->after('document_date_gregorian');
            if (!in_array('document_restrictions', $columns, true)) $table->string('document_restrictions')->nullable()->after('document_status');
            if (!in_array('previous_document_date_hijri', $columns, true)) $table->string('previous_document_date_hijri', 50)->nullable()->after('document_restrictions');
            if (!in_array('previous_document_number', $columns, true)) $table->string('previous_document_number')->nullable()->after('previous_document_date_hijri');
            if (!in_array('operation_type', $columns, true)) $table->string('operation_type')->nullable()->after('previous_document_number');
            if (!in_array('real_estate_identity_number', $columns, true)) $table->string('real_estate_identity_number')->nullable()->after('operation_type');
            if (!in_array('plan_number', $columns, true)) $table->string('plan_number')->nullable()->after('real_estate_identity_number');
            if (!in_array('plot_number', $columns, true)) $table->string('plot_number')->nullable()->after('plan_number');
            if (!in_array('block_number', $columns, true)) $table->string('block_number')->nullable()->after('plot_number');
            if (!in_array('deed_owner_identifier', $columns, true)) $table->string('deed_owner_identifier')->nullable()->after('block_number');
            if (!in_array('deed_owner_name', $columns, true)) $table->string('deed_owner_name')->nullable()->after('deed_owner_identifier');
            if (!in_array('deed_owner_nationality', $columns, true)) $table->string('deed_owner_nationality')->nullable()->after('deed_owner_name');
            if (!in_array('deed_ownership_percentage', $columns, true)) $table->decimal('deed_ownership_percentage', 8, 2)->nullable()->after('deed_owner_nationality');
            if (!in_array('deed_source', $columns, true)) $table->string('deed_source')->nullable()->after('deed_ownership_percentage');
            if (!in_array('deed_issuer', $columns, true)) $table->string('deed_issuer')->nullable()->after('deed_source');
            if (!in_array('deed_notes', $columns, true)) $table->text('deed_notes')->nullable()->after('deed_issuer');
            if (!in_array('deed_raw_excerpt', $columns, true)) $table->longText('deed_raw_excerpt')->nullable()->after('deed_notes');
        });
    }

    public function down(): void
    {
        // Intentionally left empty to avoid removing deed data from existing properties.
    }
};
