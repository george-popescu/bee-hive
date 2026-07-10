<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdatePersonRequest;
use App\Models\Person;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class AdminPersonController extends Controller
{
    public function update(UpdatePersonRequest $request, Person $person, AuditLogger $audit): JsonResponse|RedirectResponse
    {
        $data = $request->validated();
        DB::transaction(function () use ($request, $person, $audit, $data): void {
            $lockedPerson = Person::query()->whereKey($person->getKey())->lockForUpdate()->firstOrFail();
            $before = $this->snapshot($lockedPerson);
            $lockedPerson->update([
                ...$data,
                'manually_inactive' => ! $data['active'],
            ]);
            $audit->log($request->user(), $lockedPerson, 'person.updated', $before, $this->snapshot($lockedPerson->fresh()));
        });

        if ($request->expectsJson()) {
            return response()->json(['updated' => true]);
        }

        return back(status: 303)->with('success', 'Configurația persoanei a fost actualizată.');
    }

    /** @return array<string, bool|float|string|null> */
    private function snapshot(Person $person): array
    {
        return [
            'job_role' => $person->job_role,
            'default_monthly_capacity_hours' => (float) $person->default_monthly_capacity_hours,
            'weekly_capacity_hours' => $person->weekly_capacity_hours === null ? null : (float) $person->weekly_capacity_hours,
            'hourly_rate' => $person->hourly_rate === null ? null : (float) $person->hourly_rate,
            'active' => $person->active,
        ];
    }
}
