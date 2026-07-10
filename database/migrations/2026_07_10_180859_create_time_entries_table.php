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
        Schema::create('time_entries', function (Blueprint $table) {
            $table->id();
            $table->string('clickup_time_entry_id')->unique();
            $table->foreignId('click_up_task_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('person_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('clickup_user_id')->nullable()->index();
            $table->string('person_name')->nullable();
            $table->string('source_label')->nullable()->index();
            $table->timestampTz('started_at')->index();
            $table->unsignedBigInteger('duration_seconds');
            $table->boolean('is_billable')->default(false);
            $table->timestampTz('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('time_entries');
    }
};
