<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('my_rentals_ed_compact_date')) {
    function my_rentals_ed_compact_date(mixed $value): mixed
    {
        if ($value === null || $value === '') return $value;

        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        $text = trim((string) $value);
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/u', $text, $m)) {
            return $m[1] . '-' . $m[2] . '-' . $m[3];
        }
        if (preg_match('/^(\d{2})-(\d{2})-(\d{4})/u', $text, $m)) {
            return $m[3] . '-' . $m[2] . '-' . $m[1];
        }

        try {
            return \Carbon\Carbon::parse($text)->format('Y-m-d');
        } catch (\Throwable $e) {
            return $text;
        }
    }
}

if (!function_exists('my_rentals_ed_compact_value')) {
    function my_rentals_ed_compact_value(string $field, mixed $value): mixed
    {
        if (str_contains($field, 'date') || str_ends_with($field, '_at')) {
            return my_rentals_ed_compact_date($value);
        }
        return $value;
    }
}

if (!function_exists('my_rentals_ed_compact_config')) {
    function my_rentals_ed_compact_config(string $resource, array $config): array
    {
        if ($resource === 'property_expenses') {
            $config['title_fields'] = ['title', 'amount'];
            $config['editable'] = ['category_id', 'title', 'amount', 'expense_date', 'description'];
        }

        return $config;
    }
}

if (!function_exists('my_rentals_ed_compact_item_payload')) {
    function my_rentals_ed_compact_item_payload($item, string $resource, array $config): array
    {
        $config = my_rentals_ed_compact_config($resource, $config);
        $editable = my_rentals_ed_existing_fields($config, $config['editable']);
        $titleFields = my_rentals_ed_existing_fields($config, $config['title_fields']);
        $fields = [];
        $titleParts = [];

        foreach ($editable as $field) {
            $fields[$field] = my_rentals_ed_compact_value($field, $item->{$field} ?? null);
        }

        foreach ($titleFields as $field) {
            $value = my_rentals_ed_compact_value($field, $item->{$field} ?? null);
            if ($value !== null && $value !== '') {
                if ($field === 'amount') {
                    $number = (float) $value;
                    $value = rtrim(rtrim(number_format($number, 2, '.', ''), '0'), '.') . ' ريال';
                }
                $titleParts[] = (string) $value;
            }
        }

        $title = implode(' - ', $titleParts);
        if ($title === '') {
            $title = ($config['label'] ?? $resource) . ' #' . $item->id;
        }

        return [
            'id' => $item->id,
            'resource' => $resource,
            'resource_label' => $config['label'],
            'title' => $title,
            'fields' => $fields,
            'values' => $fields,
            'editable_fields' => $editable,
            'raw' => $item->toArray(),
        ];
    }
}

if (!function_exists('my_rentals_ed_compact_list_response')) {
    function my_rentals_ed_compact_list_response(string $resource, Request $request, ?\App\Models\User $user)
    {
        $config = my_rentals_ed_resource_config($resource);

        if (!$config) {
            return response()->json(['message' => 'هذا النوع غير متاح للتعديل.'], 404);
        }

        $config = my_rentals_ed_compact_config($resource, $config);
        $model = $config['model'];
        $query = my_rentals_ed_apply_scope($model::query(), $resource, $config, $user);

        $id = $request->query('id');
        if ($id !== null && $id !== '') {
            $query->where('id', (int) $id);
        } else {
            $search = trim((string) $request->query('q', ''));
            if ($search !== '') {
                $searchFields = my_rentals_ed_existing_fields($config, $config['search_fields']);
                $query->where(function ($q) use ($searchFields, $search) {
                    foreach ($searchFields as $field) {
                        $q->orWhere($field, 'like', '%' . $search . '%');
                    }
                });
            }
        }

        $items = $query->orderByDesc('id')->limit($id ? 1 : 150)->get();

        return [
            'resource' => $resource,
            'resource_label' => $config['label'],
            'editable_fields' => my_rentals_ed_existing_fields($config, $config['editable']),
            'items' => $items->map(fn ($item) => my_rentals_ed_compact_item_payload($item, $resource, $config))->values(),
        ];
    }
}

Route::get('/edit-delete-center/{resource}', function (string $resource, Request $request) {
    return my_rentals_ed_compact_list_response($resource, $request, my_rentals_ed_current_user($request));
});

Route::get('/my/edit-delete-center/{resource}', function (string $resource, Request $request) {
    $user = function_exists('my_rentals_phase3_ed_current_user')
        ? my_rentals_phase3_ed_current_user($request)
        : my_rentals_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_ed_compact_list_response($resource, $request, $user);
});
