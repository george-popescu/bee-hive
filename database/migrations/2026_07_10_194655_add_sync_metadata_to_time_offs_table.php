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
        Schema::table('time_offs', function (Blueprint $table) {
            $table->string('source')->default('manual')->index();
            $table->boolean('active')->default(true)->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('time_offs', function (Blueprint $table) {
            $table->dropColumn(['source', 'active']);
        });
    }
};
