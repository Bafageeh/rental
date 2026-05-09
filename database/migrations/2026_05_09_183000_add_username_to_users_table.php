<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'username')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('username')->nullable()->after('name');
            });
        }

        DB::table('users')
            ->select(['id', 'name', 'email', 'username'])
            ->orderBy('id')
            ->chunkById(100, function ($users) {
                foreach ($users as $user) {
                    if (! empty($user->username)) {
                        continue;
                    }

                    $base = $this->makeBaseUsername($user);
                    $username = $base;
                    $counter = 1;

                    while (DB::table('users')
                        ->where('username', $username)
                        ->where('id', '!=', $user->id)
                        ->exists()) {
                        $counter++;
                        $username = $base . $counter;
                    }

                    DB::table('users')
                        ->where('id', $user->id)
                        ->update(['username' => $username]);
                }
            });

        try {
            Schema::table('users', function (Blueprint $table) {
                $table->unique('username');
            });
        } catch (Throwable $e) {
            // قد يكون الفهرس موجودًا في بعض البيئات؛ لا نوقف الترقية لهذا السبب.
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'username')) {
            Schema::table('users', function (Blueprint $table) {
                try {
                    $table->dropUnique(['username']);
                } catch (Throwable $e) {
                    // تجاهل اختلاف أسماء الفهارس بين البيئات.
                }
                $table->dropColumn('username');
            });
        }
    }

    private function makeBaseUsername(object $user): string
    {
        $emailLocal = strtolower(trim((string) Str::before((string) ($user->email ?? ''), '@')));
        $emailLocal = preg_replace('/[^a-z0-9._-]+/', '', $emailLocal) ?: '';

        if ($emailLocal !== '') {
            return substr($emailLocal, 0, 50);
        }

        $name = strtolower(trim((string) ($user->name ?? '')));
        $name = preg_replace('/[^a-z0-9._-]+/', '', Str::ascii($name)) ?: '';

        return $name !== '' ? substr($name, 0, 50) : 'user' . $user->id;
    }
};
