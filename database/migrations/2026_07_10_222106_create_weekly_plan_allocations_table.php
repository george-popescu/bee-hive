<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weekly_plan_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_plan_id')->constrained()->restrictOnDelete();
            $table->foreignId('person_id')->constrained()->restrictOnDelete();
            $table->decimal('hours', 6, 2);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps(6);
            $table->unique(['weekly_plan_id', 'person_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_plan_allocations');
    }
};
