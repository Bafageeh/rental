<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\RelationManagerController;
use App\Http\Controllers\Api\RelationRelatedController;
use App\Services\RelationManagerService;
use App\Services\RelationRecordService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiPhaseTwoBackendOrganizationTest extends TestCase
{
    public function test_relation_manager_routes_are_backed_by_controllers_and_services(): void
    {
        $this->assertTrue(class_exists(RelationManagerController::class));
        $this->assertTrue(class_exists(RelationRelatedController::class));
        $this->assertTrue(class_exists(RelationManagerService::class));
        $this->assertTrue(class_exists(RelationRecordService::class));

        $optionsRoute = Route::getRoutes()->match(Request::create('/api/my/relation-manager/options', 'GET'));
        $deleteRoute = Route::getRoutes()->match(Request::create('/api/my/relation-manager/delete-owner-cascade/1', 'POST'));
        $relatedRoute = Route::getRoutes()->match(Request::create('/api/my/relation-manager/related/property/10', 'GET'));

        $this->assertSame(RelationManagerController::class . '@options', $optionsRoute->getActionName());
        $this->assertSame(RelationManagerController::class . '@deleteOwnerCascade', $deleteRoute->getActionName());
        $this->assertSame(RelationRelatedController::class . '@show', $relatedRoute->getActionName());

        $this->assertContains('admin.only', $deleteRoute->gatherMiddleware());
    }
}
