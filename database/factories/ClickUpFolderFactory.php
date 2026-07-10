<?php

namespace Database\Factories;

use App\Enums\ClickUpLocationKind;
use App\Models\ClickUpFolder;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ClickUpFolder>
 */
class ClickUpFolderFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'clickup_folder_id' => fake()->unique()->bothify('folder-########'),
            'clickup_space_id' => fake()->bothify('space-########'),
            'project_id' => null,
            'name' => fake()->words(3, true),
            'kind' => ClickUpLocationKind::Unmapped,
            'active' => true,
            'last_synced_at' => now(),
        ];
    }
}
