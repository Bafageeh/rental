<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('expense_categories')) {
            Schema::create('expense_categories', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code')->nullable()->unique();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('property_expenses')) {
            Schema::create('property_expenses', function (Blueprint $table) {
                $table->id();
                $table->foreignId('property_id')->constrained()->cascadeOnDelete();
                $table->foreignId('expense_category_id')->nullable()->constrained('expense_categories')->nullOnDelete();
                $table->decimal('amount', 12, 2)->default(0);
                $table->date('expense_date')->nullable();
                $table->string('title')->nullable();
                $table->text('description')->nullable();
                $table->string('receipt_file_path')->nullable();
                $table->timestamps();
            });
        } else {
            Schema::table('property_expenses', function (Blueprint $table) {
                if (!Schema::hasColumn('property_expenses', 'property_id')) {
                    $table->unsignedBigInteger('property_id')->nullable();
                }

                if (!Schema::hasColumn('property_expenses', 'expense_category_id')) {
                    $table->unsignedBigInteger('expense_category_id')->nullable();
                }

                if (!Schema::hasColumn('property_expenses', 'amount')) {
                    $table->decimal('amount', 12, 2)->default(0);
                }

                if (!Schema::hasColumn('property_expenses', 'expense_date')) {
                    $table->date('expense_date')->nullable();
                }

                if (!Schema::hasColumn('property_expenses', 'title')) {
                    $table->string('title')->nullable();
                }

                if (!Schema::hasColumn('property_expenses', 'description')) {
                    $table->text('description')->nullable();
                }

                if (!Schema::hasColumn('property_expenses', 'receipt_file_path')) {
                    $table->string('receipt_file_path')->nullable();
                }
            });
        }

        $categories = [
            ['name' => 'كهرباء الخدمات', 'code' => 'common_electricity'],
            ['name' => 'مياه', 'code' => 'water'],
            ['name' => 'إنترنت', 'code' => 'internet'],
            ['name' => 'صيانة عامة', 'code' => 'maintenance'],
            ['name' => 'نظافة', 'code' => 'cleaning'],
            ['name' => 'أخرى', 'code' => 'other'],
        ];

        foreach ($categories as $category) {
            DB::table('expense_categories')->updateOrInsert(
                ['code' => $category['code']],
                [
                    'name' => $category['name'],
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        //
    }
};
