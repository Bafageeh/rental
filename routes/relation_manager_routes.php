<?php

use App\Http\Controllers\Api\RelationManagerController;
use Illuminate\Support\Facades\Route;

require_once base_path('app/Support/RelationManagerHelpers.php');

Route::get('/relation-manager/options', [RelationManagerController::class, 'options']);
Route::get('/my/relation-manager/options', [RelationManagerController::class, 'options']);

Route::post('/relation-manager/create-property', [RelationManagerController::class, 'createProperty']);
Route::post('/my/relation-manager/create-property', [RelationManagerController::class, 'createProperty']);

Route::post('/relation-manager/create-unit', [RelationManagerController::class, 'createUnit']);
Route::post('/my/relation-manager/create-unit', [RelationManagerController::class, 'createUnit']);

Route::post('/relation-manager/cleanup-orphan-properties', [RelationManagerController::class, 'cleanupOrphanProperties'])->middleware('admin.only');
Route::post('/my/relation-manager/cleanup-orphan-properties', [RelationManagerController::class, 'cleanupOrphanProperties'])->middleware('admin.only');

Route::post('/relation-manager/delete-owner-cascade/{ownerId?}', [RelationManagerController::class, 'deleteOwnerCascade'])->middleware('admin.only');
Route::post('/my/relation-manager/delete-owner-cascade/{ownerId?}', [RelationManagerController::class, 'deleteOwnerCascade'])->middleware('admin.only');
