<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('owners')) {
            Schema::create('owners', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('phone')->nullable();
                $table->string('email')->nullable();
                $table->string('national_id')->nullable();
                $table->string('type')->default('external'); // self, external
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (!Schema::hasColumn('users', 'owner_id')) {
                    $table->unsignedBigInteger('owner_id')->nullable()->after('id');
                }
                if (!Schema::hasColumn('users', 'phone')) {
                    $table->string('phone')->nullable()->after('email');
                }
                if (!Schema::hasColumn('users', 'role')) {
                    $table->string('role')->default('owner')->after('password'); // admin, owner, accountant, viewer
                }
                if (!Schema::hasColumn('users', 'is_active')) {
                    $table->boolean('is_active')->default(true)->after('role');
                }
            });
        }

        Schema::table('properties', function (Blueprint $table) {
            if (!Schema::hasColumn('properties', 'owner_id')) {
                $table->unsignedBigInteger('owner_id')->nullable()->after('id');
            }
            if (!Schema::hasColumn('properties', 'deed_number')) {
                $table->string('deed_number')->nullable()->after('name');
            }
            if (!Schema::hasColumn('properties', 'national_short_address')) {
                $table->string('national_short_address', 8)->nullable()->after('address');
            }
            if (!Schema::hasColumn('properties', 'property_area')) {
                $table->decimal('property_area', 12, 2)->nullable()->after('national_short_address');
            }
            if (!Schema::hasColumn('properties', 'floors_count')) {
                $table->unsignedInteger('floors_count')->default(0)->after('property_area');
            }
            if (!Schema::hasColumn('properties', 'parking_spots_count')) {
                $table->unsignedInteger('parking_spots_count')->default(0)->after('floors_count');
            }
            if (!Schema::hasColumn('properties', 'property_type')) {
                $table->string('property_type')->default('building')->after('parking_spots_count');
            }
            if (!Schema::hasColumn('properties', 'management_type')) {
                $table->string('management_type')->default('owned')->after('property_type'); // owned, managed
            }
        });

        Schema::table('units', function (Blueprint $table) {
            if (!Schema::hasColumn('units', 'parent_unit_id')) {
                $table->unsignedBigInteger('parent_unit_id')->nullable()->after('property_id');
            }
            if (!Schema::hasColumn('units', 'is_subdivided')) {
                $table->boolean('is_subdivided')->default(false)->after('type');
            }
            if (!Schema::hasColumn('units', 'rooms_count')) {
                $table->unsignedInteger('rooms_count')->default(0)->after('is_subdivided');
            }
            if (!Schema::hasColumn('units', 'bathrooms_count')) {
                $table->unsignedInteger('bathrooms_count')->default(0)->after('rooms_count');
            }
            if (!Schema::hasColumn('units', 'has_kitchen')) {
                $table->boolean('has_kitchen')->default(false)->after('bathrooms_count');
            }
            if (!Schema::hasColumn('units', 'kitchen_type')) {
                $table->string('kitchen_type')->nullable()->after('has_kitchen'); // closed, open, none
            }
            if (!Schema::hasColumn('units', 'is_kitchen_installed')) {
                $table->boolean('is_kitchen_installed')->default(false)->after('kitchen_type');
            }
            if (!Schema::hasColumn('units', 'has_living_room')) {
                $table->boolean('has_living_room')->default(false)->after('is_kitchen_installed');
            }
            if (!Schema::hasColumn('units', 'is_rooftop')) {
                $table->boolean('is_rooftop')->default(false)->after('has_living_room');
            }
            if (!Schema::hasColumn('units', 'orientation')) {
                $table->string('orientation')->nullable()->after('is_rooftop'); // front, back, side
            }
        });

        Schema::table('tenants', function (Blueprint $table) {
            if (!Schema::hasColumn('tenants', 'birth_date')) {
                $table->date('birth_date')->nullable()->after('national_id');
            }
            if (!Schema::hasColumn('tenants', 'nationality')) {
                $table->string('nationality')->nullable()->after('birth_date');
            }
            if (!Schema::hasColumn('tenants', 'address')) {
                $table->text('address')->nullable()->after('email');
            }
        });

        if (!Schema::hasTable('parking_spots')) {
            Schema::create('parking_spots', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('property_id');
                $table->string('spot_number')->nullable();
                $table->decimal('monthly_fee', 12, 2)->default(0);
                $table->string('status')->default('available'); // available, reserved, rented, unavailable
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index('property_id');
            });
        }

        Schema::table('contracts', function (Blueprint $table) {
            if (!Schema::hasColumn('contracts', 'parking_spot_id')) {
                $table->unsignedBigInteger('parking_spot_id')->nullable()->after('tenant_id');
            }
            if (!Schema::hasColumn('contracts', 'government_contract_number')) {
                $table->string('government_contract_number')->nullable()->after('contract_number');
            }
            if (!Schema::hasColumn('contracts', 'parking_fee')) {
                $table->decimal('parking_fee', 12, 2)->default(0)->after('rent_amount');
            }
            if (!Schema::hasColumn('contracts', 'services_fee')) {
                $table->decimal('services_fee', 12, 2)->default(0)->after('parking_fee');
            }
            if (!Schema::hasColumn('contracts', 'deposit_amount')) {
                $table->decimal('deposit_amount', 12, 2)->default(0)->after('services_fee');
            }
            if (!Schema::hasColumn('contracts', 'source')) {
                $table->string('source')->default('manual')->after('status'); // manual, government_pdf, imported
            }
        });

        if (!Schema::hasTable('expense_categories')) {
            Schema::create('expense_categories', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code')->unique();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('property_expenses')) {
            Schema::create('property_expenses', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('property_id');
                $table->unsignedBigInteger('expense_category_id')->nullable();
                $table->string('expense_type')->nullable();
                $table->decimal('amount', 12, 2)->default(0);
                $table->date('expense_date')->nullable();
                $table->string('bill_number')->nullable();
                $table->string('vendor_name')->nullable();
                $table->string('paid_by')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index('property_id');
                $table->index('expense_category_id');
            });
        }

        if (!Schema::hasTable('property_files')) {
            Schema::create('property_files', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('property_id');
                $table->string('file_type')->default('other'); // deed, license, official_document, invoice, other
                $table->string('file_name');
                $table->string('file_path');
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('file_size')->nullable();
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('uploaded_by')->nullable();
                $table->timestamps();

                $table->index('property_id');
            });
        }

        if (!Schema::hasTable('unit_media')) {
            Schema::create('unit_media', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('unit_id');
                $table->string('media_type'); // photo, video
                $table->string('file_path');
                $table->string('thumbnail_path')->nullable();
                $table->string('title')->nullable();
                $table->text('description')->nullable();
                $table->unsignedInteger('sort_order')->default(0);
                $table->boolean('is_public')->default(false);
                $table->string('share_token')->nullable();
                $table->timestamp('share_expires_at')->nullable();
                $table->timestamps();

                $table->index('unit_id');
                $table->index('share_token');
            });
        }

        if (!Schema::hasTable('contract_files')) {
            Schema::create('contract_files', function (Blueprint $table) {
                $table->id();

                // نحفظ الملف مرتبطًا بالعقد إن وُجد
                $table->unsignedBigInteger('contract_id')->nullable();

                // ونحفظه أيضًا ضمن بيانات المستأجر للرجوع له حتى لو لم يتم إنشاء العقد بعد
                $table->unsignedBigInteger('tenant_id')->nullable();

                $table->string('file_type')->default('government_contract_pdf');
                $table->string('file_name');
                $table->string('file_path');
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('file_size')->nullable();

                $table->string('extraction_status')->default('pending'); // pending, processed, failed
                $table->json('extracted_data')->nullable();

                $table->text('notes')->nullable();
                $table->unsignedBigInteger('uploaded_by')->nullable();
                $table->timestamps();

                $table->index('contract_id');
                $table->index('tenant_id');
            });
        }

        if (!Schema::hasTable('expense_files')) {
            Schema::create('expense_files', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('property_expense_id');
                $table->string('file_name');
                $table->string('file_path');
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('file_size')->nullable();
                $table->timestamps();

                $table->index('property_expense_id');
            });
        }

        $categories = [
            ['name' => 'كهرباء خدمات', 'code' => 'common_electricity'],
            ['name' => 'مياه', 'code' => 'water'],
            ['name' => 'إنترنت', 'code' => 'internet'],
            ['name' => 'صيانة عامة', 'code' => 'general_maintenance'],
            ['name' => 'سباكة', 'code' => 'plumbing'],
            ['name' => 'كهرباء', 'code' => 'electricity_maintenance'],
            ['name' => 'مصعد', 'code' => 'elevator'],
            ['name' => 'نظافة', 'code' => 'cleaning'],
            ['name' => 'حراسة', 'code' => 'security'],
            ['name' => 'أخرى', 'code' => 'other'],
        ];

        foreach ($categories as $category) {
            DB::table('expense_categories')->updateOrInsert(
                ['code' => $category['code']],
                [
                    'name' => $category['name'],
                    'is_active' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        DB::table('owners')->updateOrInsert(
            ['type' => 'self'],
            [
                'name' => 'أملاكي الخاصة',
                'type' => 'self',
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        $selfOwnerId = DB::table('owners')->where('type', 'self')->value('id');

        if ($selfOwnerId && Schema::hasColumn('properties', 'owner_id')) {
            DB::table('properties')
                ->whereNull('owner_id')
                ->update(['owner_id' => $selfOwnerId]);
        }
    }

    public function down(): void
    {
        //
    }
};
