<?php

namespace App\Contracts;

use Carbon\CarbonInterface;

interface ClickUpClient
{
    /** @return list<array<string, mixed>> */
    public function members(): array;

    /** @return list<array<string, mixed>> */
    public function folders(): array;

    /** @return list<array<string, mixed>> */
    public function folderlessLists(): array;

    /** @return list<array<string, mixed>> */
    public function tasks(?CarbonInterface $updatedAfter = null): array;

    /**
     * @param  list<string>  $assigneeIds
     * @return list<array<string, mixed>>
     */
    public function timeEntries(CarbonInterface $from, CarbonInterface $to, array $assigneeIds): array;

    /** @return list<array<string, mixed>> */
    public function timeOffTasks(): array;
}
