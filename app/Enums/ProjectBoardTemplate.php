<?php

namespace App\Enums;

enum ProjectBoardTemplate: string
{
    case TimeAndMaterials = 'tm';
    case Deliverables = 'deliverables';

    public function label(): string
    {
        return match ($this) {
            self::TimeAndMaterials => 'Time & Materials',
            self::Deliverables => __('messages.pm_board.deliverables_template'),
        };
    }
}
