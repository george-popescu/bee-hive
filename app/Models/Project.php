<?php

namespace App\Models;

use App\Enums\ProjectBoardTemplate;
use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property ProjectBoardTemplate|null $contract_type
 * @property array<string, mixed>|null $board_config
 */
#[Fillable([
    'clickup_space_id',
    'clickup_folder_id',
    'company',
    'client',
    'name',
    'folder_name',
    'contract_type',
    'board_config',
    'board_visible',
    'active',
])]
class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use HasFactory;

    /** @return BelongsToMany<Person, $this> */
    public function managers(): BelongsToMany
    {
        return $this->belongsToMany(Person::class, 'project_manager')
            ->withTimestamps();
    }

    /** @return HasMany<Allocation, $this> */
    public function allocations(): HasMany
    {
        return $this->hasMany(Allocation::class);
    }

    /** @return HasMany<ClickUpTask, $this> */
    public function clickUpTasks(): HasMany
    {
        return $this->hasMany(ClickUpTask::class);
    }

    /** @return HasMany<ClickUpFolder, $this> */
    public function clickUpFolders(): HasMany
    {
        return $this->hasMany(ClickUpFolder::class);
    }

    /** @return HasMany<ClickUpList, $this> */
    public function clickUpLists(): HasMany
    {
        return $this->hasMany(ClickUpList::class);
    }

    /** @return HasMany<TimeEntry, $this> */
    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    /** @return HasMany<ActualAdjustment, $this> */
    public function actualAdjustments(): HasMany
    {
        return $this->hasMany(ActualAdjustment::class);
    }

    /** @return HasMany<WeeklyPlan, $this> */
    public function weeklyPlans(): HasMany
    {
        return $this->hasMany(WeeklyPlan::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'board_visible' => 'boolean',
            'active' => 'boolean',
            'contract_type' => ProjectBoardTemplate::class,
            'board_config' => 'array',
        ];
    }
}
