<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('follow_up_tasks')) {
            Schema::create('follow_up_tasks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('property_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('unit_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('contract_id')->nullable()->constrained()->nullOnDelete();
                $table->string('title');
                $table->string('task_type')->default('general'); // general, payment, maintenance, contract, tenant, document
                $table->string('priority')->default('normal'); // low, normal, high, urgent
                $table->date('due_date')->nullable();
                $table->dateTime('completed_at')->nullable();
                $table->string('status')->default('open'); // open, done, cancelled
                $table->string('assigned_to_name')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['status', 'due_date']);
                $table->index(['property_id', 'unit_id', 'tenant_id', 'contract_id'], 'followups_related_index');
            });

            return;
        }

        Schema::table('follow_up_tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('follow_up_tasks', 'property_id')) {
                $table->unsignedBigInteger('property_id')->nullable();
            }

            if (!Schema::hasColumn('follow_up_tasks', 'unit_id')) {
                $table->unsignedBigInteger('unit_id')->nullable();
            }

            if (!Schema::hasColumn('follow_up_tasks', 'tenant_id')) {
                $table->unsignedBigInteger('tenant_id')->nullable();
            }

            if (!Schema::hasColumn('follow_up_tasks', 'contract_id')) {
                $table->unsignedBigInteger('contract_id')->nullable();
            }

            if (!Schema::hasColumn('follow_up_tasks', 'title')) {
                $table->string('title')->nullable();
            }

            if (!Schema::hasColumn('follow_up_tasks', 'task_type')) {
                $table->string('task_type')->default('general');
            }

            if (!Schema::hasColumn('follow_up_tasks', 'priority')) {
                $table->string('priority')->default('normal');
            }

            if (!Schema::hasColumn('follow_up_tasks', 'due_date')) {
                $table->date('due_date')->nullable();
            }

            if (!Schema::hasColumn('follow_up_tasks', 'completed_at')) {
                $table->dateTime('completed_at')->nullable();
            }

            if (!Schema::hasColumn('follow_up_tasks', 'status')) {
                $table->string('status')->default('open');
            }

            if (!Schema::hasColumn('follow_up_tasks', 'assigned_to_name')) {
                $table->string('assigned_to_name')->nullable();
            }

            if (!Schema::hasColumn('follow_up_tasks', 'notes')) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
