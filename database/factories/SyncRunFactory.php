<?php

namespace Database\Factories;

use App\Enums\SyncRunStatus;
use App\Models\SyncRun;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SyncRun>
 */
class SyncRunFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'source' => 'clickup',
            'scope' => 'full',
            'status' => SyncRunStatus::Pending,
            'range_start' => null,
            'range_end' => null,
            'counters' => null,
            'options' => null,
            'error_message' => null,
            'triggered_by' => null,
            'started_at' => null,
            'finished_at' => null,
        ];
    }
}
