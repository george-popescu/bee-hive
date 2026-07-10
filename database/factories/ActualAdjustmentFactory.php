<?php

namespace Database\Factories;

use App\Models\ActualAdjustment;
use App\Models\Person;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActualAdjustment>
 */
class ActualAdjustmentFactory extends Factory
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
            'project_id' => Project::factory(),
            'internal_label' => fake()->randomElement(['Administrative', 'Internal', 'Training']),
            'month' => now()
                ->startOfMonth()
                ->addMonths(fake()->numberBetween(-6, 6))
                ->toDateString(),
            'hours_delta' => fake()->randomElement([-8, -4, -2, 2, 4, 8]),
            'reason' => fake()->sentence(),
            'created_by' => null,
            'created_by_name' => fake()->name(),
            'reverses_adjustment_id' => null,
            'created_at' => now(),
        ];
    }
}
