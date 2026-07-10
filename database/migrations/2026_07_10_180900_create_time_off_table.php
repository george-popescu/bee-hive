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
        Schema::create('time_offs', function (Blueprint $table) {
            $table->id();
            $table->string('clickup_task_id');
            $table->foreignId('person_id')->constrained()->restrictOnDelete();
            $table->string('status')->index();
            $table->string('type')->default('PTO');
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('days_reported', 6, 2)->nullable();
            $table->timestampTz('last_synced_at')->nullable();
            $table->timestamps();

            $table->unique(['clickup_task_id', 'person_id']);
            $table->index(['person_id', 'start_date', 'end_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('time_offs');
    }
};
