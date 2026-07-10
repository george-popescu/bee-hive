<?php

namespace Database\Factories;

use App\Models\ClickUpList;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ClickUpList>
 */
class ClickUpListFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'click_up_folder_id' => null,
            'project_id' => null,
            'clickup_list_id' => fake()->unique()->bothify('list-########'),
            'clickup_space_id' => fake()->bothify('space-########'),
            'name' => fake()->words(3, true),
            'active' => true,
            'last_synced_at' => now(),
        ];
    }
}
