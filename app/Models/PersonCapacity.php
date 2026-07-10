<?php

namespace App\Models;

use Database\Factories\PersonCapacityFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['person_id', 'month', 'capacity_hours'])]
class PersonCapacity extends Model
{
    /** @use HasFactory<PersonCapacityFactory> */
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
            'month' => 'date',
            'capacity_hours' => 'decimal:2',
        ];
    }
}
