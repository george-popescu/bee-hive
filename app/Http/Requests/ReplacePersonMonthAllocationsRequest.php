<?php

namespace App\Http\Requests;

use App\Enums\PermissionName;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ReplacePersonMonthAllocationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::ManageAllocations->value) ?? false;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'person_id' => [
                'required',
                'integer',
                Rule::exists((new Person)->getTable(), 'id')->where('active', true),
            ],
            'month' => ['required', 'date_format:Y-m'],
            'allocations' => ['required', 'array', 'max:100'],
            'allocations.*.id' => [
                'sometimes',
                'nullable',
                'integer',
                'distinct',
                Rule::exists((new Allocation)->getTable(), 'id'),
            ],
            'allocations.*.project_id' => [
                'required',
                'integer',
                Rule::exists((new Project)->getTable(), 'id')->where('active', true),
            ],
            'allocations.*.role' => ['nullable', 'string', 'max:80'],
            'allocations.*.planned_hours' => ['required', 'numeric', 'min:0', 'max:999999.99', 'multiple_of:0.25'],
            'allocations.*.weekly_hours' => ['required', 'array'],
            'allocations.*.weekly_hours.*.week_start' => ['required', 'date_format:Y-m-d', 'distinct'],
            'allocations.*.weekly_hours.*.hours' => ['required', 'numeric', 'min:0', 'max:999999.99', 'multiple_of:0.25'],
            'allocations.*.planning_comment' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $month = CarbonImmutable::createFromFormat('!Y-m', (string) $this->input('month'));
            $allocations = $this->input('allocations', []);

            if ($month === null || ! is_array($allocations)) {
                return;
            }

            $monthStart = $month->startOfMonth();
            $monthEnd = $month->endOfMonth();
            $identities = [];

            foreach ($allocations as $allocationIndex => $allocation) {
                if (! is_array($allocation)) {
                    continue;
                }

                $identity = ((int) ($allocation['project_id'] ?? 0)).'|'.trim((string) ($allocation['role'] ?? ''));

                if (isset($identities[$identity])) {
                    $validator->errors()->add(
                        "allocations.{$allocationIndex}.project_id",
                        'Each project and role combination may only appear once.',
                    );
                }

                $identities[$identity] = true;
                $total = 0.0;

                foreach ($allocation['weekly_hours'] ?? [] as $weekIndex => $week) {
                    if (! is_array($week)) {
                        continue;
                    }

                    $weekStart = CarbonImmutable::parse((string) ($week['week_start'] ?? ''));
                    $total += (float) ($week['hours'] ?? 0);

                    if (! $weekStart->isMonday()
                        || $weekStart->gt($monthEnd)
                        || $weekStart->endOfWeek()->lt($monthStart)) {
                        $validator->errors()->add(
                            "allocations.{$allocationIndex}.weekly_hours.{$weekIndex}.week_start",
                            'Each week must start on Monday and overlap the selected month.',
                        );
                    }
                }

                if (abs($total - (float) ($allocation['planned_hours'] ?? 0)) > 0.001) {
                    $validator->errors()->add(
                        "allocations.{$allocationIndex}.weekly_hours",
                        'Weekly hours must equal the monthly planned hours.',
                    );
                }
            }
        }];
    }
}
