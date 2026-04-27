<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('parking_spots')) {
            Schema::create('parking_spots', function (Blueprint $table) {
                $table->id();
                $table->foreignId('property_id')->constrained()->cascadeOnDelete();
                $table->string('spot_number');
                $table->string('location')->nullable();
                $table->decimal('monthly_fee', 12, 2)->default(0);
                $table->string('status')->default('available'); // available, reserved, occupied, maintenance
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->unique(['property_id', 'spot_number']);
            });

            return;
        }

        Schema::table('parking_spots', function (Blueprint $table) {
            if (!Schema::hasColumn('parking_spots', 'property_id')) {
                $table->unsignedBigInteger('property_id')->nullable();
            }

            if (!Schema::hasColumn('parking_spots', 'spot_number')) {
                $table->string('spot_number')->nullable();
            }

            if (!Schema::hasColumn('parking_spots', 'location')) {
                $table->string('location')->nullable();
            }

            if (!Schema::hasColumn('parking_spots', 'monthly_fee')) {
                $table->decimal('monthly_fee', 12, 2)->default(0);
            }

            if (!Schema::hasColumn('parking_spots', 'status')) {
                $table->string('status')->default('available');
            }

            if (!Schema::hasColumn('parking_spots', 'notes')) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
