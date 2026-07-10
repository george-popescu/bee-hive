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
        Schema::create('click_up_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('clickup_task_id')->unique();
            $table->string('clickup_list_id')->index();
            $table->text('name');
            $table->string('status')->nullable()->index();
            $table->unsignedBigInteger('estimate_seconds')->nullable();
            $table->timestampTz('start_at')->nullable();
            $table->timestampTz('due_at')->nullable()->index();
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
        Schema::dropIfExists('click_up_tasks');
    }
};
