<?php

return [
    'pg_dump_binary' => env('PG_DUMP_BINARY', 'pg_dump'),
    'directory' => env('BACKUP_DIRECTORY', storage_path('app/private/backups')),
    'retention_days' => (int) env('BACKUP_RETENTION_DAYS', 14),
];
