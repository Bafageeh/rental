<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('owner_bank_accounts')) {
            Schema::create('owner_bank_accounts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('owner_id')->constrained()->cascadeOnDelete();
                $table->string('bank_name')->nullable();
                $table->string('account_name')->nullable();
                $table->string('iban')->nullable();
                $table->string('account_number')->nullable();
                $table->boolean('is_default')->default(false);
                $table->boolean('is_active')->default(true);
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['owner_id', 'is_default']);
                $table->index(['is_active']);
            });

            return;
        }

        Schema::table('owner_bank_accounts', function (Blueprint $table) {
            if (!Schema::hasColumn('owner_bank_accounts', 'owner_id')) {
                $table->unsignedBigInteger('owner_id')->nullable();
            }

            if (!Schema::hasColumn('owner_bank_accounts', 'bank_name')) {
                $table->string('bank_name')->nullable();
            }

            if (!Schema::hasColumn('owner_bank_accounts', 'account_name')) {
                $table->string('account_name')->nullable();
            }

            if (!Schema::hasColumn('owner_bank_accounts', 'iban')) {
                $table->string('iban')->nullable();
            }

            if (!Schema::hasColumn('owner_bank_accounts', 'account_number')) {
                $table->string('account_number')->nullable();
            }

            if (!Schema::hasColumn('owner_bank_accounts', 'is_default')) {
                $table->boolean('is_default')->default(false);
            }

            if (!Schema::hasColumn('owner_bank_accounts', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }

            if (!Schema::hasColumn('owner_bank_accounts', 'notes')) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
