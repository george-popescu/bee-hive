<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @var array<string, string> */
    private const MODULES = [
        '869dtgahn' => 'Analytics',
        '869dw8fwb' => 'CRM',
        '869du1xj1' => 'CRM',
        '869du1xjf' => 'CRM',
        '869dxk2wn' => 'APP',
        '869du1xk2' => 'CRM',
        '869du1xk9' => 'CRM',
        '869du20aw' => 'CRM',
    ];

    public function up(): void
    {
        $this->updateConfig(fn (array $config): array => [
            ...$config,
            'gantt_modules' => [
                ...(is_array($config['gantt_modules'] ?? null) ? $config['gantt_modules'] : []),
                ...self::MODULES,
            ],
        ]);
    }

    public function down(): void
    {
        $this->updateConfig(function (array $config): array {
            $modules = is_array($config['gantt_modules'] ?? null) ? $config['gantt_modules'] : [];

            foreach (array_keys(self::MODULES) as $taskId) {
                unset($modules[$taskId]);
            }

            if ($modules === []) {
                unset($config['gantt_modules']);
            } else {
                $config['gantt_modules'] = $modules;
            }

            return $config;
        });
    }

    /** @param callable(array<string, mixed>): array<string, mixed> $callback */
    private function updateConfig(callable $callback): void
    {
        $projects = DB::table('projects')
            ->where('client', 'Osiris')
            ->where('name', 'La Depozit')
            ->get(['id', 'board_config']);

        foreach ($projects as $project) {
            $config = is_string($project->board_config)
                ? json_decode($project->board_config, true, 512, JSON_THROW_ON_ERROR)
                : (array) $project->board_config;

            DB::table('projects')->where('id', $project->id)->update([
                'board_config' => json_encode($callback($config), JSON_THROW_ON_ERROR),
            ]);
        }
    }
};
