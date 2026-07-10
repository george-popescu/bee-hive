<?php

namespace App\Models;

use Database\Factories\TimeOffFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'clickup_task_id',
    'person_id',
    'status',
    'type',
    'start_date',
    'end_date',
    'days_reported',
    'last_synced_at',
])]
class TimeOff extends Model
{
    /** @use HasFactory<TimeOffFactory> */
    use HasFactory;

    /** @return BelongsTo<Person, $this> */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'days_reported' => 'decimal:2',
            'last_synced_at' => 'datetime',
        ];
    }
}
