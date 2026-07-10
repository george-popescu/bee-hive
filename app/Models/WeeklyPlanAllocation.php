<?php

namespace App\Models;

use Database\Factories\WeeklyPlanAllocationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $person_id
 * @property string $hours
 * @property-read Person $person
 */
#[Fillable(['weekly_plan_id', 'person_id', 'hours', 'created_by', 'updated_by'])]
class WeeklyPlanAllocation extends Model
{
    /** @use HasFactory<WeeklyPlanAllocationFactory> */
    use HasFactory;

    /** @return BelongsTo<WeeklyPlan, $this> */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(WeeklyPlan::class, 'weekly_plan_id');
    }

    /** @return BelongsTo<Person, $this> */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['hours' => 'decimal:2'];
    }
}
