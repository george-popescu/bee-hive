<?php

namespace App\Enums;

enum RoleName: string
{
    case Admin = 'admin';
    case Management = 'management';
    case TeamLead = 'team-lead';
    case ProjectManager = 'pm';
}
