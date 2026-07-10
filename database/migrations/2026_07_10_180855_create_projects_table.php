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
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('clickup_space_id')->nullable()->index();
            $table->string('clickup_folder_id')->nullable()->unique();
            $table->string('company')->nullable()->index();
            $table->string('client')->nullable()->index();
            $table->string('name');
            $table->string('folder_name')->nullable();
            $table->string('contract_type')->nullable()->index();
            $table->boolean('board_visible')->default(true)->index();
            $table->boolean('active')->default(true)->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
