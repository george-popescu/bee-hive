<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('projects')
            ->whereIn('contract_type', ['time-and-materials', 'retainer'])
            ->update(['contract_type' => 'tm']);
        DB::table('projects')
            ->where('contract_type', 'fixed-price')
            ->update(['contract_type' => 'deliverables']);
        DB::table('projects')
            ->whereNull('contract_type')
            ->update(['contract_type' => 'tm']);
        DB::table('projects')
            ->where('client', 'Osiris')
            ->where('name', 'La Depozit')
            ->update(['contract_type' => 'deliverables']);

        Schema::table('time_entries', function (Blueprint $table) {
            $table->index(['project_id', 'started_at']);
            $table->index(['click_up_task_id', 'started_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            $table->dropIndex(['project_id', 'started_at']);
            $table->dropIndex(['click_up_task_id', 'started_at']);
        });
    }
};
