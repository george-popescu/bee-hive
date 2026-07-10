<?php

namespace App\Enums;

enum PermissionName: string
{
    case ViewManagement = 'management.view';
    case ViewTeamLead = 'team-lead.view';
    case ManageAllocations = 'allocations.manage';
    case ViewPmBoards = 'pm-boards.view';
    case ManagePmPlanning = 'pm-planning.manage';
    case AdjustActualHours = 'actual-hours.adjust';
    case ManageUsers = 'users.manage';
    case ManageRolesAndPermissions = 'roles-and-permissions.manage';
    case ManageSettings = 'settings.manage';
    case SyncClickUp = 'clickup.sync';
}
