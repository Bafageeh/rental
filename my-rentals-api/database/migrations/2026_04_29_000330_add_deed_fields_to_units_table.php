<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('units', function (Blueprint $table) {
            $columns = Schema::getColumnListing('units');

            if (!in_array('deed_number', $columns, true)) {
                $table->string('deed_number')->nullable()->after('owner_id');
            }
            if (!in_array('document_number', $columns, true)) {
                $table->string('document_number')->nullable()->after('deed_number');
            }
            if (!in_array('document_date_hijri', $columns, true)) {
                $table->string('document_date_hijri', 50)->nullable()->after('document_number');
            }
            if (!in_array('document_status', $columns, true)) {
                $table->string('document_status')->nullable()->after('document_date_hijri');
            }
            if (!in_array('previous_document_number', $columns, true)) {
                $table->string('previous_document_number')->nullable()->after('document_status');
            }
            if (!in_array('plan_number', $columns, true)) {
                $table->string('plan_number')->nullable()->after('previous_document_number');
            }
            if (!in_array('plot_number', $columns, true)) {
                $table->string('plot_number')->nullable()->after('plan_number');
            }
            if (!in_array('city', $columns, true)) {
                $table->string('city')->nullable()->after('plot_number');
            }
            if (!in_array('district', $columns, true)) {
                $table->string('district')->nullable()->after('city');
            }
            if (!in_array('address', $columns, true)) {
                $table->text('address')->nullable()->after('district');
            }
            if (!in_array('deed_owner_name', $columns, true)) {
                $table->string('deed_owner_name')->nullable()->after('address');
            }
            if (!in_array('deed_ownership_percentage', $columns, true)) {
                $table->decimal('deed_ownership_percentage', 8, 2)->nullable()->after('deed_owner_name');
            }
            if (!in_array('deed_raw_excerpt', $columns, true)) {
                $table->longText('deed_raw_excerpt')->nullable()->after('deed_ownership_percentage');
            }
        });
    }

    public function down(): void
    {
        // Keep deed data safe.
    }
};
