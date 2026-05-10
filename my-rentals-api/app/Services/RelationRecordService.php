<?php

namespace App\Services;

use Illuminate\Http\Request;

class RelationRecordService
{
    public function show(Request $request, string $entity, $id)
    {
        $table = mrr_entity_table($entity);
        if (!$table || !mrr_has_table($table)) {
            return response()->json(['message' => 'نوع السجل غير معروف أو الجدول غير موجود'], 404);
        }

        $record = mrr_find($table, $id);
        if (!$record) {
            return response()->json(['message' => 'السجل غير موجود'], 404);
        }

        $ownerScopeId = mrr_request_owner_scope_id($request);

        if ($ownerScopeId === 0 || ($ownerScopeId !== null && !mrr_record_belongs_to_owner($table, $record, $ownerScopeId))) {
            return mrr_owner_scope_forbidden_response();
        }

        $entityKey = mrr_table_entity($table);
        $title = mrr_label_for($table, $record);
        $fields = mrr_public_fields($table, $record);
        $sections = mrr_related_sections($entityKey, (int) $id, $ownerScopeId);
        $links = mrr_relation_links($table, $record);

        return response()->json([
            'entity' => $entityKey,
            'entity_title' => mrr_ar_entity_title($entityKey),
            'id' => (int) $id,
            'title' => $title,
            'fields' => $fields,
            'sections' => $sections,
            'links' => $links,
            'counts' => collect($sections)->mapWithKeys(fn ($section) => [$section['key'] => $section['count']])->all(),
        ]);
    }
}
