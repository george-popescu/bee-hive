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
        Schema::create('person_capacities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('person_id')->constrained()->restrictOnDelete();
            $table->date('month')->index();
            $table->decimal('capacity_hours', 8, 2);
            $table->timestamps();

            $table->unique(['person_id', 'month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('person_capacities');
    }
};
