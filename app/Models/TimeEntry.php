<?php

namespace App\Models;

use Database\Factories\TimeEntryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'clickup_time_entry_id',
    'click_up_task_id',
    'person_id',
    'project_id',
    'clickup_user_id',
    'person_name',
    'source_label',
    'started_at',
    'duration_seconds',
    'is_billable',
    'last_synced_at',
])]
class TimeEntry extends Model
{
    /** @use HasFactory<TimeEntryFactory> */
    use HasFactory;

    /** @return BelongsTo<ClickUpTask, $this> */
    public function clickUpTask(): BelongsTo
    {
        return $this->belongsTo(ClickUpTask::class);
    }

    /** @return BelongsTo<Person, $this> */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'duration_seconds' => 'integer',
            'is_billable' => 'boolean',
            'last_synced_at' => 'datetime',
        ];
    }
}
