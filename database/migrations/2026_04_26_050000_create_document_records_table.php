<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('document_records')) {
            Schema::create('document_records', function (Blueprint $table) {
                $table->id();
                $table->string('entity_type')->default('general'); // general, property, unit, tenant, contract, owner
                $table->unsignedBigInteger('entity_id')->nullable();
                $table->string('title');
                $table->string('document_type')->default('other'); // deed, contract, id, bill, photo, video, official, other
                $table->string('original_file_name')->nullable();
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('file_size')->nullable();
                $table->string('storage_path')->nullable();
                $table->string('file_url')->nullable();
                $table->date('issue_date')->nullable();
                $table->date('expiry_date')->nullable();
                $table->string('status')->default('active'); // active, archived, expired
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['entity_type', 'entity_id']);
                $table->index(['document_type', 'status']);
                $table->index(['expiry_date']);
            });

            return;
        }

        Schema::table('document_records', function (Blueprint $table) {
            if (!Schema::hasColumn('document_records', 'entity_type')) {
                $table->string('entity_type')->default('general');
            }

            if (!Schema::hasColumn('document_records', 'entity_id')) {
                $table->unsignedBigInteger('entity_id')->nullable();
            }

            if (!Schema::hasColumn('document_records', 'title')) {
                $table->string('title')->nullable();
            }

            if (!Schema::hasColumn('document_records', 'document_type')) {
                $table->string('document_type')->default('other');
            }

            if (!Schema::hasColumn('document_records', 'original_file_name')) {
                $table->string('original_file_name')->nullable();
            }

            if (!Schema::hasColumn('document_records', 'mime_type')) {
                $table->string('mime_type')->nullable();
            }

            if (!Schema::hasColumn('document_records', 'file_size')) {
                $table->unsignedBigInteger('file_size')->nullable();
            }

            if (!Schema::hasColumn('document_records', 'storage_path')) {
                $table->string('storage_path')->nullable();
            }

            if (!Schema::hasColumn('document_records', 'file_url')) {
                $table->string('file_url')->nullable();
            }

            if (!Schema::hasColumn('document_records', 'issue_date')) {
                $table->date('issue_date')->nullable();
            }

            if (!Schema::hasColumn('document_records', 'expiry_date')) {
                $table->date('expiry_date')->nullable();
            }

            if (!Schema::hasColumn('document_records', 'status')) {
                $table->string('status')->default('active');
            }

            if (!Schema::hasColumn('document_records', 'notes')) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
