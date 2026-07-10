<?php

namespace App\Enums;

enum ClickUpLocationKind: string
{
    case Unmapped = 'unmapped';
    case Project = 'project';
    case Internal = 'internal';
}
