<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach ([
            ['client' => 'La Depozit', 'name' => 'La Depozit', 'contract_type' => 'tm'],
            ['client' => 'Iancu Guda', 'name' => 'MiM', 'contract_type' => 'deliverables'],
            ['client' => 'Iancu Guda', 'name' => 'MiM DEV', 'contract_type' => 'deliverables'],
            ['client' => 'BTL', 'name' => 'CRM Platform', 'contract_type' => 'deliverables'],
        ] as $project) {
            DB::table('projects')
                ->whereNotNull('clickup_folder_id')
                ->where('client', $project['client'])
                ->where('name', $project['name'])
                ->update(['contract_type' => $project['contract_type']]);
        }

        DB::table('projects')
            ->whereNotNull('clickup_folder_id')
            ->where('client', 'BTL')
            ->where('name', 'CRM Platform')
            ->get(['id', 'board_config'])
            ->each(function (object $project): void {
                $existingConfig = is_string($project->board_config)
                    ? json_decode($project->board_config, true)
                    : $project->board_config;
                $existingConfig = is_array($existingConfig) ? $existingConfig : [];

                DB::table('projects')
                    ->where('id', $project->id)
                    ->update([
                        'board_config' => json_encode([
                            ...$existingConfig,
                            'annex_budget_list_names' => $existingConfig['annex_budget_list_names'] ?? ['Features'],
                            'annex_operational_list_names' => $existingConfig['annex_operational_list_names'] ?? ['Backlog'],
                        ], JSON_THROW_ON_ERROR),
                    ]);
            });
    }

    /**
     * Reference classifications are operational data and intentionally not reverted.
     */
    public function down(): void {}
};
