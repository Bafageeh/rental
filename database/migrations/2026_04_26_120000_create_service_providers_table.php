<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('service_providers')) {
            Schema::create('service_providers', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('provider_type')->default('general');
                $table->string('phone')->nullable();
                $table->string('alternate_phone')->nullable();
                $table->string('email')->nullable();
                $table->string('city')->nullable();
                $table->string('district')->nullable();
                $table->text('address')->nullable();
                $table->decimal('default_visit_fee', 12, 2)->default(0);
                $table->unsignedTinyInteger('rating')->nullable();
                $table->boolean('is_preferred')->default(false);
                $table->boolean('is_active')->default(true);
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['provider_type', 'is_active']);
                $table->index(['is_preferred']);
            });
        }

        if (Schema::hasTable('maintenance_requests')) {
            Schema::table('maintenance_requests', function (Blueprint $table) {
                if (!Schema::hasColumn('maintenance_requests', 'service_provider_id')) {
                    $table->unsignedBigInteger('service_provider_id')->nullable()->after('tenant_id');
                    $table->index('service_provider_id');
                }

                if (!Schema::hasColumn('maintenance_requests', 'provider_assigned_at')) {
                    $table->dateTime('provider_assigned_at')->nullable()->after('service_provider_id');
                }
            });
        }
    }

    public function down(): void
    {
        //
    }
};
