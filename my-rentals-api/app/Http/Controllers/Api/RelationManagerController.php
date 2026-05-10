<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RelationManagerService;
use Illuminate\Http\Request;

class RelationManagerController extends Controller
{
    public function __construct(private readonly RelationManagerService $relationManagerService)
    {
    }

    public function options(Request $request)
    {
        return $this->relationManagerService->options($request);
    }

    public function createProperty(Request $request)
    {
        return $this->relationManagerService->createProperty($request);
    }

    public function createUnit(Request $request)
    {
        return $this->relationManagerService->createUnit($request);
    }

    public function cleanupOrphanProperties()
    {
        return $this->relationManagerService->cleanupOrphanProperties();
    }

    public function deleteOwnerCascade(Request $request, $ownerId = null)
    {
        return $this->relationManagerService->deleteOwnerCascade($request, $ownerId);
    }
}
