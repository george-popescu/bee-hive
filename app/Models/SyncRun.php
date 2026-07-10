<?php

namespace App\Models;

use App\Enums\SyncRunStatus;
use Database\Factories\SyncRunFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property array<string, int>|null $counters
 * @property array<string, mixed>|null $options
 * @property SyncRunStatus $status
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 */
#[Fillable([
    'source',
    'scope',
    'status',
    'range_start',
    'range_end',
    'counters',
    'options',
    'error_message',
    'triggered_by',
    'started_at',
    'finished_at',
])]
class SyncRun extends Model
{
    /** @use HasFactory<SyncRunFactory> */
    use HasFactory;

    /** @return BelongsTo<User, $this> */
    public function triggeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => SyncRunStatus::class,
            'range_start' => 'datetime',
            'range_end' => 'datetime',
            'counters' => 'array',
            'options' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }
}
