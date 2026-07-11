<?php

namespace App\Models;

use Database\Factories\ActualAdjustmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use LogicException;

#[Fillable([
    'person_id',
    'project_id',
    'internal_label',
    'month',
    'effective_date',
    'hours_delta',
    'reason',
    'created_by',
    'created_by_name',
    'reverses_adjustment_id',
])]
class ActualAdjustment extends Model
{
    /** @use HasFactory<ActualAdjustmentFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

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

    /** @return BelongsTo<ActualAdjustment, $this> */
    public function reversesAdjustment(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reverses_adjustment_id');
    }

    /** @return HasOne<ActualAdjustment, $this> */
    public function reversedBy(): HasOne
    {
        return $this->hasOne(self::class, 'reverses_adjustment_id');
    }

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new LogicException('Actual adjustments are append-only and cannot be updated.');
        });

        static::deleting(function (): void {
            throw new LogicException('Actual adjustments are append-only and cannot be deleted.');
        });
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'month' => 'date',
            'effective_date' => 'date',
            'hours_delta' => 'decimal:2',
        ];
    }
}
