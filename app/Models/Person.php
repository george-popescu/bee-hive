<?php

namespace App\Models;

use Database\Factories\PersonFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id',
    'clickup_user_id',
    'name',
    'email',
    'job_role',
    'default_monthly_capacity_hours',
    'hourly_rate',
    'is_external',
    'active',
])]
class Person extends Model
{
    /** @use HasFactory<PersonFactory> */
    use HasFactory;

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsToMany<Team, $this> */
    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_memberships')
            ->withPivot('is_lead')
            ->withTimestamps();
    }

    /** @return HasMany<PersonCapacity, $this> */
    public function capacities(): HasMany
    {
        return $this->hasMany(PersonCapacity::class);
    }

    /** @return HasMany<Allocation, $this> */
    public function allocations(): HasMany
    {
        return $this->hasMany(Allocation::class);
    }

    /** @return BelongsToMany<Project, $this> */
    public function managedProjects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_manager')
            ->withTimestamps();
    }

    /** @return BelongsToMany<ClickUpTask, $this> */
    public function clickUpTasks(): BelongsToMany
    {
        return $this->belongsToMany(ClickUpTask::class, 'click_up_task_person')
            ->withTimestamps();
    }

    /** @return HasMany<TimeEntry, $this> */
    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    /** @return HasMany<TimeOff, $this> */
    public function timeOffs(): HasMany
    {
        return $this->hasMany(TimeOff::class);
    }

    /** @return HasMany<ActualAdjustment, $this> */
    public function actualAdjustments(): HasMany
    {
        return $this->hasMany(ActualAdjustment::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'default_monthly_capacity_hours' => 'decimal:2',
            'hourly_rate' => 'decimal:2',
            'is_external' => 'boolean',
            'active' => 'boolean',
        ];
    }
}
