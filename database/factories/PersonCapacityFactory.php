<?php

namespace Database\Factories;

use App\Models\Person;
use App\Models\PersonCapacity;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PersonCapacity>
 */
class PersonCapacityFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'person_id' => Person::factory(),
            'month' => now()
                ->startOfMonth()
                ->addMonths(fake()->numberBetween(-6, 6))
                ->toDateString(),
            'capacity_hours' => fake()->randomElement([120, 138, 140, 160]),
        ];
    }
}
