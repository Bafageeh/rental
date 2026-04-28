<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ApiSecurityPhaseOneTest extends TestCase
{
    private string $ownerToken = 'owner-token-phase-one';
    private string $adminToken = 'admin-token-phase-one';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'database.connections.sqlite.foreign_key_constraints' => false,
        ]);

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->createSchema();
        $this->seedRecords();
    }

    private function createSchema(): void
    {
        foreach (['contracts', 'tenants', 'units', 'properties', 'owners', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('role')->nullable();
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->string('status')->nullable();
            $table->boolean('is_active')->nullable();
            $table->string('api_token')->nullable();
            $table->timestamps();
        });

        Schema::create('owners', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('national_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->string('title')->nullable();
            $table->string('name')->nullable();
            $table->string('property_name')->nullable();
            $table->string('city')->nullable();
            $table->string('district')->nullable();
            $table->string('address')->nullable();
            $table->string('property_type')->nullable();
            $table->string('management_type')->nullable();
            $table->string('deed_number')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id')->nullable();
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->string('unit_scope')->nullable();
            $table->string('unit_number')->nullable();
            $table->string('title')->nullable();
            $table->string('name')->nullable();
            $table->string('floor')->nullable();
            $table->string('type')->nullable();
            $table->string('status')->nullable();
            $table->decimal('rent_amount', 12, 2)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->string('contract_number')->nullable();
            $table->string('government_contract_number')->nullable();
            $table->unsignedBigInteger('property_id')->nullable();
            $table->unsignedBigInteger('unit_id')->nullable();
            $table->unsignedBigInteger('tenant_id')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });
    }

    private function seedRecords(): void
    {
        DB::table('owners')->insert([
            ['id' => 1, 'name' => 'مالك آمن', 'phone' => '0500000001', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'مالك آخر', 'phone' => '0500000002', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('users')->insert([
            [
                'id' => 1,
                'name' => 'حساب مالك',
                'email' => 'owner@example.test',
                'role' => 'owner',
                'owner_id' => 1,
                'status' => 'active',
                'is_active' => true,
                'api_token' => hash('sha256', $this->ownerToken),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'name' => 'حساب مدير',
                'email' => 'admin@example.test',
                'role' => 'admin',
                'owner_id' => null,
                'status' => 'active',
                'is_active' => true,
                'api_token' => hash('sha256', $this->adminToken),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('properties')->insert([
            ['id' => 10, 'owner_id' => 1, 'title' => 'عقار المالك الآمن', 'city' => 'جدة', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 20, 'owner_id' => 2, 'title' => 'عقار المالك الآخر', 'city' => 'جدة', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('units')->insert([
            ['id' => 100, 'property_id' => 10, 'owner_id' => 1, 'unit_scope' => 'property', 'unit_number' => 'A-1', 'status' => 'available', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 200, 'property_id' => 20, 'owner_id' => 2, 'unit_scope' => 'property', 'unit_number' => 'B-1', 'status' => 'available', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('tenants')->insert([
            ['id' => 1000, 'name' => 'مستأجر تابع', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2000, 'name' => 'مستأجر آخر', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('contracts')->insert([
            ['id' => 10000, 'contract_number' => 'C-1', 'property_id' => 10, 'unit_id' => 100, 'tenant_id' => 1000, 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 20000, 'contract_number' => 'C-2', 'property_id' => 20, 'unit_id' => 200, 'tenant_id' => 2000, 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function test_api_token_is_not_accepted_from_query_or_body(): void
    {
        $this->getJson('/api/my/relation-manager/options?api_token=' . $this->ownerToken)
            ->assertUnauthorized();

        $this->postJson('/api/my/relation-manager/create-property', [
            'api_token' => $this->ownerToken,
            'owner_id' => 1,
            'title' => 'محاولة غير آمنة',
        ])->assertUnauthorized();
    }

    public function test_x_api_token_header_is_accepted_and_owner_options_are_scoped(): void
    {
        $response = $this->withHeader('X-Api-Token', $this->ownerToken)
            ->getJson('/api/my/relation-manager/options');

        $response->assertOk()
            ->assertJsonFragment(['name' => 'مالك آمن'])
            ->assertJsonMissing(['name' => 'مالك آخر'])
            ->assertJsonFragment(['title' => 'عقار المالك الآمن'])
            ->assertJsonMissing(['title' => 'عقار المالك الآخر']);
    }

    public function test_owner_cannot_use_dangerous_relation_manager_actions(): void
    {
        $this->withHeader('X-Api-Token', $this->ownerToken)
            ->postJson('/api/my/relation-manager/delete-owner-cascade/1')
            ->assertForbidden();

        $this->withHeader('X-Api-Token', $this->ownerToken)
            ->postJson('/api/my/relation-manager/cleanup-orphan-properties')
            ->assertForbidden();
    }

    public function test_owner_cannot_read_related_records_outside_their_scope(): void
    {
        $this->withHeader('X-Api-Token', $this->ownerToken)
            ->getJson('/api/my/relation-manager/related/property/10')
            ->assertOk()
            ->assertJsonPath('id', 10);

        $this->withHeader('X-Api-Token', $this->ownerToken)
            ->getJson('/api/my/relation-manager/related/property/20')
            ->assertForbidden();
    }

    public function test_owner_create_property_is_forced_to_their_owner_id(): void
    {
        $this->withHeader('X-Api-Token', $this->ownerToken)
            ->postJson('/api/my/relation-manager/create-property', [
                'owner_id' => 2,
                'title' => 'عقار لا يمكن نسبته لمالك آخر',
            ])
            ->assertOk();

        $this->assertSame(
            1,
            (int) DB::table('properties')->where('title', 'عقار لا يمكن نسبته لمالك آخر')->value('owner_id')
        );
    }
}
