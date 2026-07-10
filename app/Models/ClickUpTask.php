<?php

namespace App\Models;

use Database\Factories\ClickUpTaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property Carbon|null $start_at
 * @property Carbon|null $due_at
 */
#[Fillable([
    'project_id',
    'clickup_task_id',
    'clickup_list_id',
    'name',
    'status',
    'estimate_seconds',
    'start_at',
    'due_at',
    'active',
    'last_synced_at',
])]
class ClickUpTask extends Model
{
    /** @use HasFactory<ClickUpTaskFactory> */
    use HasFactory;

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return BelongsTo<ClickUpList, $this> */
    public function clickUpList(): BelongsTo
    {
        return $this->belongsTo(ClickUpList::class, 'clickup_list_id', 'clickup_list_id');
    }

    /** @return BelongsToMany<Person, $this> */
    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(Person::class, 'click_up_task_person')
            ->withTimestamps();
    }

    /** @return HasMany<TimeEntry, $this> */
    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'estimate_seconds' => 'integer',
            'start_at' => 'datetime',
            'due_at' => 'datetime',
            'active' => 'boolean',
            'last_synced_at' => 'datetime',
        ];
    }
}
