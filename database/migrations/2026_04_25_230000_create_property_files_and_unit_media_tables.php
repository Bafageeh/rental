<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('property_files')) {
            Schema::create('property_files', function (Blueprint $table) {
                $table->id();
                $table->foreignId('property_id')->constrained()->cascadeOnDelete();
                $table->string('file_name');
                $table->string('file_path');
                $table->string('file_type')->nullable();
                $table->unsignedBigInteger('file_size')->nullable();
                $table->string('category')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        } else {
            Schema::table('property_files', function (Blueprint $table) {
                if (!Schema::hasColumn('property_files', 'property_id')) {
                    $table->unsignedBigInteger('property_id')->nullable();
                }
                if (!Schema::hasColumn('property_files', 'file_name')) {
                    $table->string('file_name')->nullable();
                }
                if (!Schema::hasColumn('property_files', 'file_path')) {
                    $table->string('file_path')->nullable();
                }
                if (!Schema::hasColumn('property_files', 'file_type')) {
                    $table->string('file_type')->nullable();
                }
                if (!Schema::hasColumn('property_files', 'file_size')) {
                    $table->unsignedBigInteger('file_size')->nullable();
                }
                if (!Schema::hasColumn('property_files', 'category')) {
                    $table->string('category')->nullable();
                }
                if (!Schema::hasColumn('property_files', 'notes')) {
                    $table->text('notes')->nullable();
                }
            });
        }

        if (!Schema::hasTable('unit_media')) {
            Schema::create('unit_media', function (Blueprint $table) {
                $table->id();
                $table->foreignId('unit_id')->constrained()->cascadeOnDelete();
                $table->string('file_name');
                $table->string('file_path');
                $table->string('file_type')->nullable();
                $table->unsignedBigInteger('file_size')->nullable();
                $table->string('media_type')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        } else {
            Schema::table('unit_media', function (Blueprint $table) {
                if (!Schema::hasColumn('unit_media', 'unit_id')) {
                    $table->unsignedBigInteger('unit_id')->nullable();
                }
                if (!Schema::hasColumn('unit_media', 'file_name')) {
                    $table->string('file_name')->nullable();
                }
                if (!Schema::hasColumn('unit_media', 'file_path')) {
                    $table->string('file_path')->nullable();
                }
                if (!Schema::hasColumn('unit_media', 'file_type')) {
                    $table->string('file_type')->nullable();
                }
                if (!Schema::hasColumn('unit_media', 'file_size')) {
                    $table->unsignedBigInteger('file_size')->nullable();
                }
                if (!Schema::hasColumn('unit_media', 'media_type')) {
                    $table->string('media_type')->nullable();
                }
                if (!Schema::hasColumn('unit_media', 'notes')) {
                    $table->text('notes')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        // Safe no-op.
    }
};
