<?php

namespace Database\Factories;

use App\Models\Person;
use App\Models\TimeOff;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TimeOff>
 */
class TimeOffFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startDate = CarbonImmutable::instance(fake()->dateTimeBetween('-3 months', '+3 months'))
            ->startOfDay();
        $daysReported = fake()->numberBetween(1, 10);

        return [
            'clickup_task_id' => fake()->unique()->bothify('pto-########'),
            'person_id' => Person::factory(),
            'status' => fake()->randomElement(['approved', 'on leave', 'complete']),
            'type' => 'PTO',
            'start_date' => $startDate->toDateString(),
            'end_date' => $startDate->addDays($daysReported - 1)->toDateString(),
            'days_reported' => $daysReported,
            'source' => 'manual',
            'active' => true,
            'last_synced_at' => now(),
        ];
    }
}
