<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        $hasRole = Schema::hasColumn('users', 'role');
        $hasOwnerId = Schema::hasColumn('users', 'owner_id');
        $hasStatus = Schema::hasColumn('users', 'status');
        $hasIsActive = Schema::hasColumn('users', 'is_active');
        $hasUpdatedAt = Schema::hasColumn('users', 'updated_at');

        if ($hasRole) {
            $updates = ['role' => 'admin'];
            if ($hasUpdatedAt) {
                $updates['updated_at'] = now();
            }

            $query = DB::table('users')
                ->where(function ($query) {
                    $query->whereNull('role')
                        ->orWhere('role', '')
                        ->orWhere('role', 'owner');
                });

            if ($hasOwnerId) {
                $query->whereNull('owner_id');
            }

            /*
             * أي مستخدم قديم بلا owner_id هو حساب إدارة للتطبيق، وليس حساب مالك.
             * هذا يعالج ظهور "ليس لديك صلاحية" واختفاء شاشات الملاك والإدارة.
             */
            $query->update($updates);
        }

        if ($hasStatus) {
            $updates = ['status' => 'active'];
            if ($hasUpdatedAt) {
                $updates['updated_at'] = now();
            }

            $query = DB::table('users')
                ->where(function ($query) {
                    $query->whereNull('status')
                        ->orWhere('status', '')
                        ->orWhere('status', 'disabled')
                        ->orWhere('status', 'inactive');
                });

            if ($hasOwnerId) {
                $query->whereNull('owner_id');
            }

            $query->update($updates);
        }

        if ($hasIsActive) {
            $updates = ['is_active' => true];
            if ($hasUpdatedAt) {
                $updates['updated_at'] = now();
            }

            $query = DB::table('users');

            if ($hasOwnerId) {
                $query->whereNull('owner_id');
            }

            $query->update($updates);
        }

        if ($hasRole) {
            $adminExists = DB::table('users')
                ->whereIn('role', ['admin', 'manager', 'super_admin'])
                ->exists();

            if (!$adminExists) {
                $firstUser = DB::table('users')->orderBy('id')->first();

                if ($firstUser) {
                    $updates = ['role' => 'admin'];
                    if ($hasUpdatedAt) {
                        $updates['updated_at'] = now();
                    }

                    DB::table('users')
                        ->where('id', $firstUser->id)
                        ->update($updates);
                }
            }
        }
    }

    public function down(): void
    {
        //
    }
};
