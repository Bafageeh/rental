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
        'name', 'email', 'password',
        'role', 'owner_id', 'status',
        'api_token', 'notes', 'last_login_at',
    ];

    protected $hidden = ['password', 'remember_token', 'api_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at'     => 'datetime',
            'password'          => 'hashed',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Owner::class);
    }

    public function effectiveRole(): string
    {
        $role = strtolower(trim((string) ($this->role ?? '')));

        if ($role === '' || $role === 'null') {
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

    public function scopeActive($q)
    {
        return $q->where('status', 'active');
    }
}
