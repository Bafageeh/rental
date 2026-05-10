<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('app_settings')) {
            Schema::create('app_settings', function (Blueprint $table) {
                $table->id();
                $table->string('key')->unique();
                $table->text('value')->nullable();
                $table->string('type')->default('string'); // string, number, boolean, text
                $table->string('group')->default('general');
                $table->string('label')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['group']);
            });

            return;
        }

        Schema::table('app_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('app_settings', 'key')) {
                $table->string('key')->nullable()->unique();
            }

            if (!Schema::hasColumn('app_settings', 'value')) {
                $table->text('value')->nullable();
            }

            if (!Schema::hasColumn('app_settings', 'type')) {
                $table->string('type')->default('string');
            }

            if (!Schema::hasColumn('app_settings', 'group')) {
                $table->string('group')->default('general');
            }

            if (!Schema::hasColumn('app_settings', 'label')) {
                $table->string('label')->nullable();
            }

            if (!Schema::hasColumn('app_settings', 'notes')) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
