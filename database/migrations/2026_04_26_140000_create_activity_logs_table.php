<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('activity_logs')) {
            Schema::create('activity_logs', function (Blueprint $table) {
                $table->id();
                $table->string('action'); // create, update, archive, delete, restore, login
                $table->string('resource')->nullable();
                $table->string('resource_label')->nullable();
                $table->unsignedBigInteger('record_id')->nullable();
                $table->string('record_title')->nullable();
                $table->unsignedBigInteger('owner_id')->nullable();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('user_name')->nullable();
                $table->string('user_email')->nullable();
                $table->json('old_payload')->nullable();
                $table->json('new_payload')->nullable();
                $table->json('metadata')->nullable();
                $table->ipAddress('ip_address')->nullable();
                $table->text('user_agent')->nullable();
                $table->timestamps();

                $table->index(['action']);
                $table->index(['resource', 'record_id']);
                $table->index(['owner_id']);
                $table->index(['user_id']);
                $table->index(['created_at']);
            });

            return;
        }

        Schema::table('activity_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('activity_logs', 'action')) {
                $table->string('action')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'resource')) {
                $table->string('resource')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'resource_label')) {
                $table->string('resource_label')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'record_id')) {
                $table->unsignedBigInteger('record_id')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'record_title')) {
                $table->string('record_title')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'owner_id')) {
                $table->unsignedBigInteger('owner_id')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'user_id')) {
                $table->unsignedBigInteger('user_id')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'user_name')) {
                $table->string('user_name')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'user_email')) {
                $table->string('user_email')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'old_payload')) {
                $table->json('old_payload')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'new_payload')) {
                $table->json('new_payload')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'metadata')) {
                $table->json('metadata')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'ip_address')) {
                $table->ipAddress('ip_address')->nullable();
            }

            if (!Schema::hasColumn('activity_logs', 'user_agent')) {
                $table->text('user_agent')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
