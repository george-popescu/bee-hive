<?php

namespace App\Http\Requests;

use App\Enums\PermissionName;
use App\Models\Person;
use App\Models\Project;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateAllocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::ManageAllocations->value) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'person_id' => [
                'required',
                'integer',
                Rule::exists((new Person)->getTable(), 'id')->where('active', true),
            ],
            'project_id' => [
                'required',
                'integer',
                Rule::exists((new Project)->getTable(), 'id')->where('active', true),
            ],
            'role' => ['nullable', 'string', 'max:80'],
            'month' => ['required', 'date_format:Y-m'],
            'planned_hours' => ['required', 'numeric', 'min:0', 'max:999999.99', 'multiple_of:0.25'],
            'weekly_hours' => ['sometimes', 'array'],
            'weekly_hours.*.week_start' => ['required', 'date_format:Y-m-d', 'distinct'],
            'weekly_hours.*.hours' => ['required', 'numeric', 'min:0', 'max:999999.99', 'multiple_of:0.25'],
            'planning_comment' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (! $this->has('weekly_hours') || $validator->errors()->isNotEmpty()) {
                return;
            }

            $month = CarbonImmutable::createFromFormat('!Y-m', (string) $this->input('month'));
            $weeklyHours = $this->input('weekly_hours', []);

            if ($month === null || ! is_array($weeklyHours)) {
                return;
            }

            $monthStart = $month->startOfMonth();
            $monthEnd = $month->endOfMonth();
            $total = 0.0;

            foreach ($weeklyHours as $index => $week) {
                if (! is_array($week)) {
                    continue;
                }

                $weekStart = CarbonImmutable::parse((string) ($week['week_start'] ?? ''));
                $total += (float) ($week['hours'] ?? 0);

                if (! $weekStart->isMonday()
                    || $weekStart->gt($monthEnd)
                    || $weekStart->endOfWeek()->lt($monthStart)) {
                    $validator->errors()->add(
                        "weekly_hours.{$index}.week_start",
                        'Each week must start on Monday and overlap the selected month.',
                    );
                }
            }

            if (abs($total - (float) $this->input('planned_hours')) > 0.001) {
                $validator->errors()->add('weekly_hours', 'Weekly hours must equal the monthly planned hours.');
            }
        }];
    }
}
