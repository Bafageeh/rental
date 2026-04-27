<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('utility_bills')) {
            Schema::create('utility_bills', function (Blueprint $table) {
                $table->id();
                $table->foreignId('property_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('property_expense_id')->nullable();
                $table->string('bill_type')->default('other'); // common_electricity, water, internet, other
                $table->string('provider')->nullable();
                $table->string('bill_number')->nullable();
                $table->decimal('amount', 12, 2)->default(0);
                $table->date('bill_date')->nullable();
                $table->date('due_date')->nullable();
                $table->date('paid_date')->nullable();
                $table->string('status')->default('due'); // due, paid, overdue, cancelled
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['property_id', 'bill_type']);
                $table->index(['status', 'due_date']);
            });

            return;
        }

        Schema::table('utility_bills', function (Blueprint $table) {
            if (!Schema::hasColumn('utility_bills', 'property_id')) {
                $table->unsignedBigInteger('property_id')->nullable();
            }

            if (!Schema::hasColumn('utility_bills', 'property_expense_id')) {
                $table->unsignedBigInteger('property_expense_id')->nullable();
            }

            if (!Schema::hasColumn('utility_bills', 'bill_type')) {
                $table->string('bill_type')->default('other');
            }

            if (!Schema::hasColumn('utility_bills', 'provider')) {
                $table->string('provider')->nullable();
            }

            if (!Schema::hasColumn('utility_bills', 'bill_number')) {
                $table->string('bill_number')->nullable();
            }

            if (!Schema::hasColumn('utility_bills', 'amount')) {
                $table->decimal('amount', 12, 2)->default(0);
            }

            if (!Schema::hasColumn('utility_bills', 'bill_date')) {
                $table->date('bill_date')->nullable();
            }

            if (!Schema::hasColumn('utility_bills', 'due_date')) {
                $table->date('due_date')->nullable();
            }

            if (!Schema::hasColumn('utility_bills', 'paid_date')) {
                $table->date('paid_date')->nullable();
            }

            if (!Schema::hasColumn('utility_bills', 'status')) {
                $table->string('status')->default('due');
            }

            if (!Schema::hasColumn('utility_bills', 'notes')) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
