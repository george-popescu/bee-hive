<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weekly_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->restrictOnDelete();
            $table->foreignId('click_up_task_id')->constrained()->restrictOnDelete();
            $table->date('week_start');
            $table->boolean('selected')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps(6);
            $table->unique(['click_up_task_id', 'week_start']);
            $table->index(['project_id', 'week_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_plans');
    }
};
