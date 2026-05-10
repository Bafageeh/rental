<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RelationRecordService;
use Illuminate\Http\Request;

class RelationRelatedController extends Controller
{
    public function __construct(private readonly RelationRecordService $relationRecordService)
    {
    }

    public function show(Request $request, string $entity, $id)
    {
        return $this->relationRecordService->show($request, $entity, $id);
    }
}
