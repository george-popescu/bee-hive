<?php

namespace Database\Factories;

use App\Models\ClickUpTask;
use App\Models\Project;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ClickUpTask>
 */
class ClickUpTaskFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startAt = CarbonImmutable::instance(fake()->dateTimeBetween('-3 months', '+3 months'));

        return [
            'project_id' => Project::factory(),
            'clickup_task_id' => fake()->unique()->bothify('task-########'),
            'clickup_list_id' => fake()->bothify('list-########'),
            'name' => fake()->sentence(5),
            'status' => fake()->randomElement(['to do', 'in progress', 'complete']),
            'estimate_seconds' => fake()->numberBetween(1, 80) * 1800,
            'start_at' => $startAt,
            'due_at' => $startAt->addDays(fake()->numberBetween(1, 30)),
            'active' => true,
            'last_synced_at' => now(),
        ];
    }
}
