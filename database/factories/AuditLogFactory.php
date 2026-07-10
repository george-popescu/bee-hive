<?php

namespace Database\Factories;

use App\Models\AuditLog;
use App\Models\Person;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AuditLog>
 */
class AuditLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'action' => 'updated',
            'auditable_type' => Person::class,
            'auditable_id' => Person::factory(),
            'before' => ['active' => true],
            'after' => ['active' => false],
            'created_at' => now(),
        ];
    }
}
