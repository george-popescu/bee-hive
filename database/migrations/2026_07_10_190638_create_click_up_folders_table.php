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
        Schema::create('click_up_folders', function (Blueprint $table) {
            $table->id();
            $table->string('clickup_folder_id')->unique();
            $table->string('clickup_space_id')->index();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('kind')->default('unmapped')->index();
            $table->boolean('active')->default(true)->index();
            $table->timestampTz('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('click_up_folders');
    }
};
