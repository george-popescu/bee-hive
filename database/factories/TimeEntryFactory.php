<?php

namespace Database\Factories;

use App\Models\Person;
use App\Models\Project;
use App\Models\TimeEntry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TimeEntry>
 */
class TimeEntryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'clickup_time_entry_id' => fake()->unique()->bothify('entry-########'),
            'click_up_task_id' => null,
            'person_id' => Person::factory(),
            'project_id' => Project::factory(),
            'clickup_user_id' => fake()->numerify('##########'),
            'person_name' => fake()->name(),
            'source_label' => fake()->randomElement(['ClickUp', 'Imported', 'Manual']),
            'started_at' => fake()->dateTimeBetween('-6 months', 'now'),
            'duration_seconds' => fake()->numberBetween(1, 16) * 1800,
            'is_billable' => fake()->boolean(75),
            'last_synced_at' => now(),
        ];
    }
}
