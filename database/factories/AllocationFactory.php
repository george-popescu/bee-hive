<?php

namespace Database\Factories;

use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Allocation>
 */
class AllocationFactory extends Factory
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
            'role' => fake()->randomElement([
                'Developer',
                'Project Manager',
                'Quality Assurance',
                'UX Designer',
            ]),
            'month' => now()
                ->startOfMonth()
                ->addMonths(fake()->numberBetween(-6, 6))
                ->toDateString(),
            'planned_hours' => fake()->randomFloat(2, 1, 160),
            'created_by' => null,
            'updated_by' => null,
        ];
    }
}
