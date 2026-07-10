<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditLogger
{
    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    public function log(User $actor, Model $subject, string $action, array $before, array $after): AuditLog
    {
        return AuditLog::query()->create([
            'user_id' => $actor->getKey(),
            'actor_name' => $actor->name,
            'actor_email' => $actor->email,
            'action' => $action,
            'auditable_type' => $subject->getMorphClass(),
            'auditable_id' => $subject->getKey(),
            'before' => $before,
            'after' => $after,
            'created_at' => now(),
        ]);
    }
}
