<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('unit_inspections')) {
            Schema::create('unit_inspections', function (Blueprint $table) {
                $table->id();
                $table->foreignId('property_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('unit_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('contract_id')->nullable()->constrained()->nullOnDelete();

                $table->string('inspection_type')->default('periodic'); // move_in, move_out, periodic, maintenance
                $table->string('status')->default('open'); // open, completed, needs_repair, cancelled
                $table->date('inspection_date')->nullable();
                $table->string('inspector_name')->nullable();

                $table->string('electricity_meter_reading')->nullable();
                $table->string('water_meter_reading')->nullable();
                $table->unsignedInteger('keys_count')->nullable();

                $table->boolean('walls_ok')->default(true);
                $table->boolean('doors_ok')->default(true);
                $table->boolean('windows_ok')->default(true);
                $table->boolean('plumbing_ok')->default(true);
                $table->boolean('electricity_ok')->default(true);
                $table->boolean('ac_ok')->default(true);
                $table->boolean('kitchen_ok')->default(true);
                $table->boolean('bathrooms_ok')->default(true);
                $table->boolean('cleanliness_ok')->default(true);

                $table->text('damage_notes')->nullable();
                $table->decimal('estimated_repair_cost', 12, 2)->default(0);
                $table->text('recommendations')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['property_id', 'unit_id', 'tenant_id', 'contract_id'], 'unit_inspections_related_index');
                $table->index(['inspection_type', 'status']);
                $table->index(['inspection_date']);
            });

            return;
        }

        Schema::table('unit_inspections', function (Blueprint $table) {
            $columns = Schema::getColumnListing('unit_inspections');

            if (!in_array('property_id', $columns, true)) {
                $table->unsignedBigInteger('property_id')->nullable();
            }

            if (!in_array('unit_id', $columns, true)) {
                $table->unsignedBigInteger('unit_id')->nullable();
            }

            if (!in_array('tenant_id', $columns, true)) {
                $table->unsignedBigInteger('tenant_id')->nullable();
            }

            if (!in_array('contract_id', $columns, true)) {
                $table->unsignedBigInteger('contract_id')->nullable();
            }

            if (!in_array('inspection_type', $columns, true)) {
                $table->string('inspection_type')->default('periodic');
            }

            if (!in_array('status', $columns, true)) {
                $table->string('status')->default('open');
            }

            if (!in_array('inspection_date', $columns, true)) {
                $table->date('inspection_date')->nullable();
            }

            if (!in_array('inspector_name', $columns, true)) {
                $table->string('inspector_name')->nullable();
            }

            if (!in_array('electricity_meter_reading', $columns, true)) {
                $table->string('electricity_meter_reading')->nullable();
            }

            if (!in_array('water_meter_reading', $columns, true)) {
                $table->string('water_meter_reading')->nullable();
            }

            if (!in_array('keys_count', $columns, true)) {
                $table->unsignedInteger('keys_count')->nullable();
            }

            foreach ([
                'walls_ok',
                'doors_ok',
                'windows_ok',
                'plumbing_ok',
                'electricity_ok',
                'ac_ok',
                'kitchen_ok',
                'bathrooms_ok',
                'cleanliness_ok',
            ] as $column) {
                if (!in_array($column, $columns, true)) {
                    $table->boolean($column)->default(true);
                }
            }

            if (!in_array('damage_notes', $columns, true)) {
                $table->text('damage_notes')->nullable();
            }

            if (!in_array('estimated_repair_cost', $columns, true)) {
                $table->decimal('estimated_repair_cost', 12, 2)->default(0);
            }

            if (!in_array('recommendations', $columns, true)) {
                $table->text('recommendations')->nullable();
            }

            if (!in_array('notes', $columns, true)) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
