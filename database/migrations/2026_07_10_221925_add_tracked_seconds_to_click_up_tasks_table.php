<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('click_up_tasks', function (Blueprint $table) {
            $table->unsignedBigInteger('tracked_seconds')->nullable()->after('estimate_seconds');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('click_up_tasks', function (Blueprint $table) {
            $table->dropColumn('tracked_seconds');
        });
    }
};
