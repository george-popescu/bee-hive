<?php

namespace App\Services\PmBoard;

use App\Models\User;
use App\Models\WeeklyPlan;
use App\Services\Audit\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class WeeklyPlanningService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param array{
     *     project_id: int,
     *     click_up_task_id: int,
     *     week_start: string,
     *     selected: bool,
     *     allocations: list<array{person_id: int, hours: float|int|string}>,
     *     version: int|null
     * } $data
     */
    public function upsert(array $data, User $user): WeeklyPlan
    {
        return DB::transaction(function () use ($data, $user): WeeklyPlan {
            $plan = WeeklyPlan::query()
                ->where('click_up_task_id', $data['click_up_task_id'])
                ->whereDate('week_start', $data['week_start'])
                ->lockForUpdate()
                ->first();
            $before = $plan === null ? [] : $this->snapshot($plan->load('allocations'));

            if (($plan === null && $data['version'] !== null)
                || ($plan !== null && $data['version'] !== $plan->version)) {
                throw new ConflictHttpException(__('messages.pm_board.planning_conflict'));
            }

            if ($plan === null) {
                $plan = WeeklyPlan::query()->create([
                    'project_id' => $data['project_id'],
                    'click_up_task_id' => $data['click_up_task_id'],
                    'week_start' => $data['week_start'],
                    'selected' => $data['selected'],
                    'version' => 1,
                    'created_by' => $user->getKey(),
                    'updated_by' => $user->getKey(),
                ]);
            } else {
                $plan->update([
                    'selected' => $data['selected'],
                    'version' => $plan->version + 1,
                    'updated_by' => $user->getKey(),
                ]);
            }

            $positiveAllocations = collect($data['allocations'])
                ->filter(fn (array $allocation): bool => (float) $allocation['hours'] > 0)
                ->keyBy('person_id');
            $plan->allocations()
                ->whereNotIn('person_id', $positiveAllocations->keys()->all())
                ->delete();

            foreach ($positiveAllocations as $allocation) {
                $existing = $plan->allocations()->firstOrNew(['person_id' => $allocation['person_id']]);
                $existing->fill([
                    'hours' => round((float) $allocation['hours'], 2),
                    'updated_by' => $user->getKey(),
                ]);

                if (! $existing->exists) {
                    $existing->created_by = $user->getKey();
                }

                $existing->save();
            }

            $plan->touch();
            $plan->load('allocations.person');
            $this->audit->log($user, $plan, 'weekly_plan.upserted', $before, $this->snapshot($plan));

            return $plan;
        });
    }

    /** @return array<string, mixed> */
    private function snapshot(WeeklyPlan $plan): array
    {
        return [
            'selected' => $plan->selected,
            'version' => $plan->version,
            'week_start' => CarbonImmutable::parse($plan->week_start)->toDateString(),
            'allocations' => $plan->allocations->map(fn ($allocation): array => [
                'person_id' => $allocation->person_id,
                'hours' => (float) $allocation->hours,
            ])->values()->all(),
        ];
    }
}
