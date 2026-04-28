<?php

use App\Http\Controllers\Api\RelationRelatedController;
use Illuminate\Support\Facades\Route;

require_once base_path('app/Support/RelationRelatedHelpers.php');

Route::get('/relation-manager/related/{entity}/{id}', [RelationRelatedController::class, 'show'])->middleware('admin.only');
Route::get('/my/relation-manager/related/{entity}/{id}', [RelationRelatedController::class, 'show']);
