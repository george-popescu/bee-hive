<?php

namespace App\Models;

use Database\Factories\WeeklyPlanFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property bool $selected
 * @property int $version
 * @property Carbon|null $updated_at
 * @property-read Collection<int, WeeklyPlanAllocation> $allocations
 */
#[Fillable(['project_id', 'click_up_task_id', 'week_start', 'selected', 'version', 'created_by', 'updated_by'])]
class WeeklyPlan extends Model
{
    /** @use HasFactory<WeeklyPlanFactory> */
    use HasFactory;

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return BelongsTo<ClickUpTask, $this> */
    public function task(): BelongsTo
    {
        return $this->belongsTo(ClickUpTask::class, 'click_up_task_id');
    }

    /** @return HasMany<WeeklyPlanAllocation, $this> */
    public function allocations(): HasMany
    {
        return $this->hasMany(WeeklyPlanAllocation::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['week_start' => 'date', 'selected' => 'boolean', 'version' => 'integer'];
    }
}
