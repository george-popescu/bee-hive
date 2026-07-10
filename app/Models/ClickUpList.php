<?php

namespace App\Models;

use Database\Factories\ClickUpListFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'click_up_folder_id',
    'project_id',
    'clickup_list_id',
    'clickup_space_id',
    'name',
    'active',
    'last_synced_at',
])]
class ClickUpList extends Model
{
    /** @use HasFactory<ClickUpListFactory> */
    use HasFactory;

    /** @return BelongsTo<ClickUpFolder, $this> */
    public function folder(): BelongsTo
    {
        return $this->belongsTo(ClickUpFolder::class, 'click_up_folder_id');
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return HasMany<ClickUpTask, $this> */
    public function tasks(): HasMany
    {
        return $this->hasMany(ClickUpTask::class, 'clickup_list_id', 'clickup_list_id');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'last_synced_at' => 'datetime',
        ];
    }
}
