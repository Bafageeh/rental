<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('payment_receipts')) {
            Schema::create('payment_receipts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
                $table->foreignId('contract_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
                $table->decimal('amount', 12, 2)->default(0);
                $table->date('received_date')->nullable();
                $table->string('method')->nullable(); // cash, bank_transfer, mada, stc_pay, other
                $table->string('reference_number')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['payment_id', 'received_date']);
                $table->index(['contract_id', 'tenant_id']);
            });

            return;
        }

        Schema::table('payment_receipts', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_receipts', 'payment_id')) {
                $table->unsignedBigInteger('payment_id')->nullable();
            }

            if (!Schema::hasColumn('payment_receipts', 'contract_id')) {
                $table->unsignedBigInteger('contract_id')->nullable();
            }

            if (!Schema::hasColumn('payment_receipts', 'tenant_id')) {
                $table->unsignedBigInteger('tenant_id')->nullable();
            }

            if (!Schema::hasColumn('payment_receipts', 'amount')) {
                $table->decimal('amount', 12, 2)->default(0);
            }

            if (!Schema::hasColumn('payment_receipts', 'received_date')) {
                $table->date('received_date')->nullable();
            }

            if (!Schema::hasColumn('payment_receipts', 'method')) {
                $table->string('method')->nullable();
            }

            if (!Schema::hasColumn('payment_receipts', 'reference_number')) {
                $table->string('reference_number')->nullable();
            }

            if (!Schema::hasColumn('payment_receipts', 'notes')) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
