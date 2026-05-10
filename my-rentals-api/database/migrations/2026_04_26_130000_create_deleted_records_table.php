<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('deleted_records')) {
            Schema::create('deleted_records', function (Blueprint $table) {
                $table->id();
                $table->string('resource');
                $table->string('resource_label')->nullable();
                $table->string('table_name');
                $table->unsignedBigInteger('record_id');
                $table->string('record_title')->nullable();
                $table->unsignedBigInteger('owner_id')->nullable();
                $table->unsignedBigInteger('deleted_by_user_id')->nullable();
                $table->string('deleted_by_name')->nullable();
                $table->json('payload');
                $table->json('metadata')->nullable();
                $table->string('status')->default('deleted'); // deleted, restored, purged
                $table->timestamp('deleted_at')->nullable();
                $table->timestamp('restored_at')->nullable();
                $table->unsignedBigInteger('restored_by_user_id')->nullable();
                $table->text('restore_error')->nullable();
                $table->timestamps();

                $table->index(['resource', 'record_id']);
                $table->index(['status']);
                $table->index(['owner_id']);
                $table->index(['deleted_at']);
            });

            return;
        }

        Schema::table('deleted_records', function (Blueprint $table) {
            if (!Schema::hasColumn('deleted_records', 'resource')) {
                $table->string('resource')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'resource_label')) {
                $table->string('resource_label')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'table_name')) {
                $table->string('table_name')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'record_id')) {
                $table->unsignedBigInteger('record_id')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'record_title')) {
                $table->string('record_title')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'owner_id')) {
                $table->unsignedBigInteger('owner_id')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'deleted_by_user_id')) {
                $table->unsignedBigInteger('deleted_by_user_id')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'deleted_by_name')) {
                $table->string('deleted_by_name')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'payload')) {
                $table->json('payload')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'metadata')) {
                $table->json('metadata')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'status')) {
                $table->string('status')->default('deleted');
            }

            if (!Schema::hasColumn('deleted_records', 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'restored_at')) {
                $table->timestamp('restored_at')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'restored_by_user_id')) {
                $table->unsignedBigInteger('restored_by_user_id')->nullable();
            }

            if (!Schema::hasColumn('deleted_records', 'restore_error')) {
                $table->text('restore_error')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
