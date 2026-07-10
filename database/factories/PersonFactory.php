<?php

namespace Database\Factories;

use App\Models\Person;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Person>
 */
class PersonFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => null,
            'clickup_user_id' => fake()->unique()->numerify('##########'),
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'job_role' => fake()->randomElement([
                'Backend Developer',
                'Frontend Developer',
                'Project Manager',
                'Quality Assurance Engineer',
                'UX Designer',
            ]),
            'default_monthly_capacity_hours' => fake()->randomElement([120, 138, 140, 160]),
            'hourly_rate' => fake()->randomFloat(2, 25, 150),
            'is_external' => false,
            'active' => true,
        ];
    }
}
