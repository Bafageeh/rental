<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
        'label',
        'notes',
    ];

    public static function getValue(string $key, mixed $default = null): mixed
    {
        $setting = static::where('key', $key)->first();

        if (!$setting) {
            return $default;
        }

        if ($setting->type === 'boolean') {
            return in_array(strtolower((string) $setting->value), ['1', 'true', 'yes', 'on'], true);
        }

        if ($setting->type === 'number') {
            return is_numeric($setting->value) ? (float) $setting->value : $default;
        }

        return $setting->value ?? $default;
    }

    public static function setValue(
        string $key,
        mixed $value,
        string $type = 'string',
        string $group = 'general',
        ?string $label = null,
        ?string $notes = null
    ): static {
        return static::updateOrCreate(
            ['key' => $key],
            [
                'value' => is_bool($value) ? ($value ? '1' : '0') : (string) $value,
                'type' => $type,
                'group' => $group,
                'label' => $label,
                'notes' => $notes,
            ]
        );
    }
}
