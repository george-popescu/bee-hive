<?php

namespace Database\Factories;

use App\Models\Person;
use App\Models\User;
use App\Models\WeeklyPlan;
use App\Models\WeeklyPlanAllocation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WeeklyPlanAllocation>
 */
class WeeklyPlanAllocationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'weekly_plan_id' => WeeklyPlan::factory(),
            'person_id' => Person::factory(),
            'hours' => fake()->randomFloat(2, 1, 40),
            'created_by' => User::factory(),
            'updated_by' => User::factory(),
        ];
    }
}
