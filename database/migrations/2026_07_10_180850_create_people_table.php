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
        Schema::create('people', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('clickup_user_id')->nullable()->unique();
            $table->string('name');
            $table->string('email')->nullable()->index();
            $table->string('job_role')->nullable()->index();
            $table->decimal('default_monthly_capacity_hours', 8, 2)->default(138);
            $table->decimal('hourly_rate', 10, 2)->nullable();
            $table->boolean('is_external')->default(false)->index();
            $table->boolean('active')->default(true)->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('people');
    }
};
