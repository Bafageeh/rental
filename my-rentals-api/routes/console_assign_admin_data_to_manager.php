<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

if (!function_exists('rent_admin_transfer_normalize_phone')) {
    function rent_admin_transfer_normalize_phone(?string $phone): string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone);
        if ($phone === '') return '';
        if (Str::startsWith($phone, '00')) $phone = substr($phone, 2);
        if (Str::startsWith($phone, '966')) return $phone;
        if (Str::startsWith($phone, '0')) return '966' . substr($phone, 1);
        if (Str::startsWith($phone, '5') && strlen($phone) === 9) return '966' . $phone;
        return $phone;
    }
}

if (!function_exists('rent_admin_transfer_local_phone')) {
    function rent_admin_transfer_local_phone(?string $phone): string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone);
        if ($phone === '') return '';
        if (Str::startsWith($phone, '966')) return '0' . substr($phone, 3);
        if (Str::startsWith($phone, '5') && strlen($phone) === 9) return '0' . $phone;
        return $phone;
    }
}

if (!function_exists('rent_admin_transfer_ensure_columns')) {
    function rent_admin_transfer_ensure_columns(): void
    {
        $tables = [
            'owners',
            'properties',
            'units',
            'tenants',
            'contracts',
            'payments',
            'property_expenses',
            'parking_spots',
            'contract_files',
            'property_files',
            'unit_media',
            'owner_transfers',
            'owner_settlements',
            'owner_bank_accounts',
            'chat_threads',
            'chat_messages',
            'users',
        ];

        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName) && !Schema::hasColumn($tableName, 'manager_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->unsignedBigInteger('manager_id')->nullable()->index();
                });
            }
        }
    }
}

if (!function_exists('rent_admin_transfer_admin_owned_query')) {
    function rent_admin_transfer_admin_owned_query(string $tableName)
    {
        return DB::table($tableName)->where(function ($query) use ($tableName) {
            if (Schema::hasColumn($tableName, 'manager_id')) {
                $query->whereNull('manager_id')->orWhere('manager_id', 0);
            } else {
                $query->whereRaw('1 = 0');
            }
        });
    }
}

if (!function_exists('rent_admin_transfer_update_null_manager')) {
    function rent_admin_transfer_update_null_manager(string $tableName, int $managerId, bool $dryRun = false): int
    {
        if (!Schema::hasTable($tableName) || !Schema::hasColumn($tableName, 'manager_id')) return 0;

        $query = rent_admin_transfer_admin_owned_query($tableName);
        $count = (clone $query)->count();
        if ($dryRun || $count <= 0) return $count;

        $updates = ['manager_id' => $managerId];
        if (Schema::hasColumn($tableName, 'updated_at')) $updates['updated_at'] = now();
        $query->update($updates);

        return $count;
    }
}

Artisan::command('rent:assign-admin-data-to-manager {phone=0500007650} {--dry-run}', function () {
    rent_admin_transfer_ensure_columns();

    $phoneInput = (string) $this->argument('phone');
    $normalizedPhone = rent_admin_transfer_normalize_phone($phoneInput);
    $localPhone = rent_admin_transfer_local_phone($normalizedPhone);

    if ($normalizedPhone === '' || !Str::startsWith($normalizedPhone, '9665')) {
        $this->error('رقم الجوال غير صحيح. مثال: 0500007650');
        return self::FAILURE;
    }

    $variants = array_values(array_unique(array_filter([$phoneInput, $normalizedPhone, $localPhone, preg_replace('/\D+/', '', $phoneInput)])));

    $manager = DB::table('users')
        ->where(function ($query) use ($variants) {
            if (Schema::hasColumn('users', 'username')) $query->orWhereIn('username', $variants);
            if (Schema::hasColumn('users', 'phone')) $query->orWhereIn('phone', $variants);
        })
        ->orderByDesc('id')
        ->first();

    $dryRun = (bool) $this->option('dry-run');

    if (!$manager) {
        if ($dryRun) {
            $this->warn('وضع تجربة فقط: سيتم إنشاء مستخدم مدير عقارات للجوال ' . $localPhone);
            $managerId = 0;
        } else {
            $payload = [
                'name' => 'مدير العقارات',
                'email' => 'manager+' . sha1($normalizedPhone) . '@rental.local',
                'password' => Hash::make('123456'),
            ];
            if (Schema::hasColumn('users', 'username')) $payload['username'] = $localPhone ?: $normalizedPhone;
            if (Schema::hasColumn('users', 'phone')) $payload['phone'] = $normalizedPhone;
            if (Schema::hasColumn('users', 'role')) $payload['role'] = 'manager';
            if (Schema::hasColumn('users', 'status')) $payload['status'] = 'active';
            if (Schema::hasColumn('users', 'password_set_at')) $payload['password_set_at'] = now();
            if (Schema::hasColumn('users', 'created_at')) $payload['created_at'] = now();
            if (Schema::hasColumn('users', 'updated_at')) $payload['updated_at'] = now();

            $managerId = DB::table('users')->insertGetId($payload);
            $manager = DB::table('users')->where('id', $managerId)->first();
            $this->info('تم إنشاء مستخدم مدير عقارات جديد. كلمة المرور المبدئية: 123456');
        }
    } else {
        $managerId = (int) $manager->id;
        if (!$dryRun) {
            $updates = [];
            if (Schema::hasColumn('users', 'role')) $updates['role'] = 'manager';
            if (Schema::hasColumn('users', 'status')) $updates['status'] = 'active';
            if (Schema::hasColumn('users', 'phone')) $updates['phone'] = $normalizedPhone;
            if (Schema::hasColumn('users', 'username')) $updates['username'] = $localPhone ?: $normalizedPhone;
            if (Schema::hasColumn('users', 'updated_at')) $updates['updated_at'] = now();
            DB::table('users')->where('id', $managerId)->update($updates);
        }
    }

    $managerId = $managerId ?: (int) ($manager->id ?? 0);
    if ($managerId <= 0 && !$dryRun) {
        $this->error('تعذر تحديد مستخدم مدير العقارات.');
        return self::FAILURE;
    }

    $this->info('مدير العقارات المستهدف: ' . ($localPhone ?: $normalizedPhone) . ' | user_id=' . ($managerId ?: 'سيتم إنشاؤه'));
    $this->line('سيتم نقل بيانات admin فقط، وهي السجلات التي manager_id فيها فارغ. لن يتم لمس بيانات أي مدير آخر.');

    $tables = [
        'owners',
        'properties',
        'units',
        'tenants',
        'contracts',
        'payments',
        'property_expenses',
        'parking_spots',
        'contract_files',
        'property_files',
        'unit_media',
        'owner_transfers',
        'owner_settlements',
        'owner_bank_accounts',
    ];

    foreach ($tables as $tableName) {
        $count = rent_admin_transfer_update_null_manager($tableName, $managerId, $dryRun);
        $this->line(($dryRun ? '[تجربة] ' : '') . $tableName . ': ' . $count);
    }

    if (Schema::hasTable('users') && Schema::hasColumn('users', 'manager_id')) {
        $relatedOwnerIds = Schema::hasTable('owners') && Schema::hasColumn('owners', 'manager_id')
            ? DB::table('owners')->where('manager_id', $managerId)->pluck('id')->all()
            : [];
        $relatedTenantIds = Schema::hasTable('tenants') && Schema::hasColumn('tenants', 'manager_id')
            ? DB::table('tenants')->where('manager_id', $managerId)->pluck('id')->all()
            : [];

        $usersQuery = DB::table('users')
            ->where(function ($query) {
                $query->whereNull('manager_id')->orWhere('manager_id', 0);
            })
            ->where(function ($query) use ($relatedOwnerIds, $relatedTenantIds, $managerId) {
                if (!empty($relatedOwnerIds) && Schema::hasColumn('users', 'owner_id')) $query->orWhereIn('owner_id', $relatedOwnerIds);
                if (!empty($relatedTenantIds) && Schema::hasColumn('users', 'tenant_id')) $query->orWhereIn('tenant_id', $relatedTenantIds);
                $query->orWhere('id', $managerId);
            })
            ->where(function ($query) {
                if (Schema::hasColumn('users', 'role')) {
                    $query->whereNull('role')->orWhereNotIn('role', ['admin', 'super_admin']);
                }
            });

        $usersCount = (clone $usersQuery)->count();
        if (!$dryRun && $usersCount > 0) {
            $updates = ['manager_id' => $managerId];
            if (Schema::hasColumn('users', 'updated_at')) $updates['updated_at'] = now();
            $usersQuery->update($updates);
        }
        $this->line(($dryRun ? '[تجربة] ' : '') . 'users linked to transferred owners/tenants: ' . $usersCount);
    }

    if (Schema::hasTable('chat_threads') && Schema::hasColumn('chat_threads', 'manager_id')) {
        $threadQuery = DB::table('chat_threads')->where(function ($query) {
            $query->whereNull('manager_id')->orWhere('manager_id', 0);
        })->where(function ($query) use ($managerId) {
            if (Schema::hasColumn('chat_threads', 'owner_id') && Schema::hasTable('owners')) {
                $query->orWhereIn('owner_id', DB::table('owners')->where('manager_id', $managerId)->select('id'));
            }
            if (Schema::hasColumn('chat_threads', 'property_id') && Schema::hasTable('properties')) {
                $query->orWhereIn('property_id', DB::table('properties')->where('manager_id', $managerId)->select('id'));
            }
            if (Schema::hasColumn('chat_threads', 'unit_id') && Schema::hasTable('units')) {
                $query->orWhereIn('unit_id', DB::table('units')->where('manager_id', $managerId)->select('id'));
            }
            if (Schema::hasColumn('chat_threads', 'contract_id') && Schema::hasTable('contracts')) {
                $query->orWhereIn('contract_id', DB::table('contracts')->where('manager_id', $managerId)->select('id'));
            }
            if (Schema::hasColumn('chat_threads', 'tenant_id') && Schema::hasTable('tenants')) {
                $query->orWhereIn('tenant_id', DB::table('tenants')->where('manager_id', $managerId)->select('id'));
            }
        });

        $threadIds = (clone $threadQuery)->pluck('id')->all();
        if (!$dryRun && !empty($threadIds)) {
            $updates = ['manager_id' => $managerId];
            if (Schema::hasColumn('chat_threads', 'updated_at')) $updates['updated_at'] = now();
            DB::table('chat_threads')->whereIn('id', $threadIds)->update($updates);

            if (Schema::hasTable('chat_messages') && Schema::hasColumn('chat_messages', 'manager_id')) {
                $messageUpdates = ['manager_id' => $managerId];
                if (Schema::hasColumn('chat_messages', 'updated_at')) $messageUpdates['updated_at'] = now();
                DB::table('chat_messages')->whereIn('thread_id', $threadIds)->where(function ($query) {
                    $query->whereNull('manager_id')->orWhere('manager_id', 0);
                })->update($messageUpdates);
            }
        }
        $this->line(($dryRun ? '[تجربة] ' : '') . 'chat_threads linked to transferred data: ' . count($threadIds));
    }

    $this->info($dryRun ? 'انتهى الفحص التجريبي بدون تعديل.' : 'تم نقل بيانات admin فقط إلى مدير العقارات المحدد.');
    return self::SUCCESS;
})->purpose('Assign only unscoped/admin rental data to a property manager user by phone.');
