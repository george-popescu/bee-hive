<?php

namespace App\Models;

use App\Enums\ClickUpLocationKind;
use Database\Factories\ClickUpFolderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** @property ClickUpLocationKind $kind */
#[Fillable([
    'clickup_folder_id',
    'clickup_space_id',
    'project_id',
    'name',
    'kind',
    'active',
    'last_synced_at',
])]
class ClickUpFolder extends Model
{
    /** @use HasFactory<ClickUpFolderFactory> */
    use HasFactory;

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return HasMany<ClickUpList, $this> */
    public function lists(): HasMany
    {
        return $this->hasMany(ClickUpList::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'kind' => ClickUpLocationKind::class,
            'active' => 'boolean',
            'last_synced_at' => 'datetime',
        ];
    }
}
