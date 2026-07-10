<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('people', function (Blueprint $table) {
            $table->decimal('weekly_capacity_hours', 6, 2)->nullable()->after('default_monthly_capacity_hours');
        });
        Schema::table('projects', function (Blueprint $table) {
            $table->json('board_config')->nullable()->after('contract_type');
        });

        DB::table('people')->where('active', true)->where('is_external', false)->update(['weekly_capacity_hours' => 40]);
        DB::table('people')->where('name', 'Simona Burciu')->update(['weekly_capacity_hours' => 20]);
        DB::table('people')->where('name', 'Alexandra Negruti')->update(['weekly_capacity_hours' => 30]);
        DB::table('projects')->where('client', 'Osiris')->where('name', 'La Depozit')->update([
            'board_config' => json_encode([
                'excluded_task_ids' => ['869d201wr', '869d32fhg', '869ca3yyc', '869apv53r'],
                'allowed_resource_names' => [
                    'Dragoș Burciu',
                    'George Popescu',
                    'Pierina Giusiano',
                    'Alexandra Negruti',
                    'Alex Mateiu',
                    'Stefan Oprea',
                ],
                'resource_roles' => [
                    'Dragoș Burciu' => 'BE / TTL',
                    'George Popescu' => 'BE',
                    'Pierina Giusiano' => 'FE / QA',
                    'Alexandra Negruti' => 'FE',
                    'Alex Mateiu' => 'QA',
                    'Stefan Oprea' => 'BE',
                ],
            ], JSON_THROW_ON_ERROR),
        ]);
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('board_config');
        });
        Schema::table('people', function (Blueprint $table) {
            $table->dropColumn('weekly_capacity_hours');
        });
    }
};
