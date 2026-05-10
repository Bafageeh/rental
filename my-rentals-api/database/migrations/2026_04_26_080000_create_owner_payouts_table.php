<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('owner_payouts')) {
            Schema::create('owner_payouts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('owner_id')->constrained()->cascadeOnDelete();
                $table->decimal('amount', 12, 2)->default(0);
                $table->date('payout_date')->nullable();
                $table->date('period_start')->nullable();
                $table->date('period_end')->nullable();
                $table->string('method')->nullable(); // bank_transfer, cash, cheque, other
                $table->string('reference_number')->nullable();
                $table->string('status')->default('paid'); // pending, paid, cancelled
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['owner_id', 'payout_date']);
                $table->index(['status']);
            });

            return;
        }

        Schema::table('owner_payouts', function (Blueprint $table) {
            if (!Schema::hasColumn('owner_payouts', 'owner_id')) {
                $table->unsignedBigInteger('owner_id')->nullable();
            }

            if (!Schema::hasColumn('owner_payouts', 'amount')) {
                $table->decimal('amount', 12, 2)->default(0);
            }

            if (!Schema::hasColumn('owner_payouts', 'payout_date')) {
                $table->date('payout_date')->nullable();
            }

            if (!Schema::hasColumn('owner_payouts', 'period_start')) {
                $table->date('period_start')->nullable();
            }

            if (!Schema::hasColumn('owner_payouts', 'period_end')) {
                $table->date('period_end')->nullable();
            }

            if (!Schema::hasColumn('owner_payouts', 'method')) {
                $table->string('method')->nullable();
            }

            if (!Schema::hasColumn('owner_payouts', 'reference_number')) {
                $table->string('reference_number')->nullable();
            }

            if (!Schema::hasColumn('owner_payouts', 'status')) {
                $table->string('status')->default('paid');
            }

            if (!Schema::hasColumn('owner_payouts', 'notes')) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
