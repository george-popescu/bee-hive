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
        DB::table('actual_adjustments')
            ->whereNull('effective_date')
            ->update(['effective_date' => DB::raw('month')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // The backfilled date is intentionally preserved on rollback.
    }
};
