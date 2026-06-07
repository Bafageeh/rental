<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name', 'username', 'email', 'phone', 'national_id', 'password', 'password_set_at',
        'role', 'owner_id', 'tenant_id', 'status',
        'api_token', 'notes', 'last_login_at',
    ];

    protected $hidden = ['password', 'remember_token', 'api_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at'     => 'datetime',
            'password_set_at'   => 'datetime',
            'password'          => 'hashed',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Owner::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function effectiveRole(): string
    {
        $rawRole = trim((string) ($this->role ?? ''));
        $role = $this->normalizeRole($rawRole);

        // الحسابات القديمة قبل إضافة نظام الصلاحيات لم يكن لديها role واضح.
        if ($role === '' || $role === 'null') {
            return 'admin';
        }

        // احتياط مهم: بعض قواعد البيانات القديمة حفظت حساب المدير باسم/بريد Admin
        // مع role غير صحيح مثل owner بعد تجارب إدارة الملاك.
        if ($this->looksLikeLegacyAdminAccount() && $role !== 'super_admin') {
            return 'admin';
        }

        if ($role === 'owner' && empty($this->owner_id)) {
            return 'admin';
        }

        return $role;
    }

    public function isAdmin(): bool
    {
        return in_array($this->effectiveRole(), ['admin', 'manager', 'super_admin'], true);
    }

    public function isOwner(): bool
    {
        return $this->effectiveRole() === 'owner';
    }

    public function isTenant(): bool
    {
        return $this->effectiveRole() === 'tenant';
    }

    public function scopeActive($q)
    {
        return $q->where('status', 'active');
    }

    private function normalizeRole(string $role): string
    {
        $role = strtolower(trim($role));
        $role = str_replace(['-', ' '], '_', $role);

        return match ($role) {
            '', 'null' => $role,
            'admin', 'administrator', 'مدير', 'المدير', 'ادمن', 'أدمن', 'إدمن', 'مشرف', 'مشرف_عام' => 'admin',
            'superadmin', 'super_admin', 'system_admin', 'مدير_عام', 'المدير_العام' => 'super_admin',
            'manager', 'agent', 'property_manager', 'مدير_العقارات', 'وكيل', 'مسؤول' => 'manager',
            'owner', 'landlord', 'مالك', 'المالك' => 'owner',
            'tenant', 'renter', 'lessee', 'مستاجر', 'مستأجر', 'المستاجر', 'المستأجر' => 'tenant',
            default => $role,
        };
    }

    private function looksLikeLegacyAdminAccount(): bool
    {
        $name = mb_strtolower(trim((string) ($this->name ?? '')));
        $email = mb_strtolower(trim((string) ($this->email ?? '')));
        $username = mb_strtolower(trim((string) ($this->username ?? '')));

        if (in_array($name, ['admin', 'administrator', 'مدير', 'المدير'], true)) {
            return true;
        }

        if (in_array($username, ['admin', 'administrator', 'manager'], true)) {
            return true;
        }

        return str_starts_with($email, 'admin@')
            || str_contains($email, '+admin@')
            || str_contains($email, '.admin@');
    }
}
