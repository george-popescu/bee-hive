<?php

namespace App\Models;

use Database\Factories\AllocationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $person_id
 * @property int $project_id
 * @property string $role
 * @property float|string $planned_hours
 * @property list<array{week_start: string, hours: float|int}>|null $weekly_hours
 * @property string|null $planning_comment
 */
#[Fillable([
    'person_id',
    'project_id',
    'role',
    'month',
    'planned_hours',
    'weekly_hours',
    'planning_comment',
    'created_by',
    'updated_by',
])]
class Allocation extends Model
{
    /** @use HasFactory<AllocationFactory> */
    use HasFactory;

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

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'month' => 'date',
            'planned_hours' => 'decimal:2',
            'weekly_hours' => 'array',
        ];
    }
}
