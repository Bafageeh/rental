<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('properties') || !Schema::hasTable('owners')) {
            return;
        }

        if (!Schema::hasColumn('properties', 'owner_id')) {
            return;
        }

        $ownerId = DB::table('owners')
            ->where('type', 'self')
            ->value('id');

        if (!$ownerId) {
            $ownerId = DB::table('owners')->insertGetId([
                'name' => 'أملاكي الخاصة',
                'type' => 'self',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('properties')
            ->whereNull('owner_id')
            ->update([
                'owner_id' => $ownerId,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // لا يتم إرجاع الربط؛ لأن كل عقار يجب أن يبقى تابعًا لمالك.
    }
};
