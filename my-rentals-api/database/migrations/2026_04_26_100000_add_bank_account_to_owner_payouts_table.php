<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('owner_payouts')) {
            return;
        }

        Schema::table('owner_payouts', function (Blueprint $table) {
            if (!Schema::hasColumn('owner_payouts', 'owner_bank_account_id')) {
                $table->unsignedBigInteger('owner_bank_account_id')->nullable()->after('owner_id');
                $table->index('owner_bank_account_id');
            }
        });
    }

    public function down(): void
    {
        //
    }
};
