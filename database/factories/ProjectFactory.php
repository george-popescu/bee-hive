<?php

namespace Database\Factories;

use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'clickup_space_id' => fake()->numerify('##########'),
            'clickup_folder_id' => fake()->unique()->numerify('##########'),
            'company' => fake()->company(),
            'client' => fake()->company(),
            'name' => fake()->unique()->words(3, true),
            'folder_name' => fake()->words(3, true),
            'contract_type' => fake()->randomElement([
                'fixed-price',
                'retainer',
                'time-and-materials',
            ]),
            'board_visible' => true,
            'active' => true,
        ];
    }
}
