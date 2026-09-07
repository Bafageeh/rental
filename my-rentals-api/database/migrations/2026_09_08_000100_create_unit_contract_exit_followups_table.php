<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('unit_contract_exit_followups')) return;

        Schema::create('unit_contract_exit_followups', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('manager_id')->nullable()->index();
            $table->unsignedBigInteger('owner_id')->nullable()->index();
            $table->unsignedBigInteger('property_id')->nullable()->index();
            $table->unsignedBigInteger('unit_id')->index();
            $table->unsignedBigInteger('contract_id')->index();
            $table->unsignedBigInteger('tenant_id')->nullable()->index();
            $table->string('decision', 40)->nullable()->index();
            $table->unsignedBigInteger('responded_by')->nullable()->index();
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('last_notified_at')->nullable()->index();
            $table->timestamps();
            $table->unique(['unit_id', 'contract_id'], 'unit_contract_exit_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('unit_contract_exit_followups');
    }
};
