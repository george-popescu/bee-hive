<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('projects')
            ->where('client', 'Osiris')
            ->where('name', 'La Depozit')
            ->update(['contract_type' => 'tm']);
    }

    public function down(): void
    {
        DB::table('projects')
            ->where('client', 'Osiris')
            ->where('name', 'La Depozit')
            ->update(['contract_type' => 'deliverables']);
    }
};
