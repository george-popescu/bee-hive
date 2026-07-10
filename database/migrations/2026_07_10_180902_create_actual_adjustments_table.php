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
        Schema::create('actual_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('person_id')->constrained()->restrictOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('internal_label')->nullable()->index();
            $table->date('month')->index();
            $table->decimal('hours_delta', 8, 2);
            $table->text('reason');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('created_by_name');
            $table->foreignId('reverses_adjustment_id')
                ->nullable()
                ->unique()
                ->constrained('actual_adjustments')
                ->restrictOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['person_id', 'month']);
            $table->index(['project_id', 'month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('actual_adjustments');
    }
};
