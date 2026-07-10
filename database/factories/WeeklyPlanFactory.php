<?php

namespace Database\Factories;

use App\Models\ClickUpTask;
use App\Models\Project;
use App\Models\User;
use App\Models\WeeklyPlan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WeeklyPlan>
 */
class WeeklyPlanFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'click_up_task_id' => ClickUpTask::factory(),
            'week_start' => now()->startOfWeek(),
            'selected' => true,
            'version' => 1,
            'created_by' => User::factory(),
            'updated_by' => User::factory(),
        ];
    }
}
