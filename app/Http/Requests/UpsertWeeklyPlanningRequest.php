<?php

namespace App\Http\Requests;

use App\Enums\PermissionName;
use App\Enums\ProjectBoardTemplate;
use App\Models\Project;
use App\Services\PmBoard\PmBoardScope;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertWeeklyPlanningRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && $user->can(PermissionName::ManagePmPlanning->value)
            && in_array((int) $this->input('project_id'), app(PmBoardScope::class)->projectIds($user), true);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $project = Project::query()->find((int) $this->input('project_id'));
        $excludedTaskIds = data_get($project?->board_config, 'excluded_task_ids', []);
        $allowedResourceNames = data_get($project?->board_config, 'allowed_resource_names', []);
        $excludedTaskIds = is_array($excludedTaskIds) ? $excludedTaskIds : [];
        $allowedResourceNames = is_array($allowedResourceNames) ? $allowedResourceNames : [];

        return [
            'project_id' => [
                'required',
                'integer',
                Rule::exists('projects', 'id')->where('contract_type', ProjectBoardTemplate::Deliverables->value),
            ],
            'click_up_task_id' => [
                'required',
                'integer',
                Rule::exists('click_up_tasks', 'id')->where(fn ($query) => $query
                    ->where('project_id', (int) $this->input('project_id'))
                    ->where('active', true)
                    ->whereNotIn('clickup_task_id', $excludedTaskIds)
                    ->whereRaw("LOWER(COALESCE(status, '')) NOT LIKE '%done%'")
                    ->whereRaw("LOWER(COALESCE(status, '')) NOT LIKE '%complete%'")
                    ->whereRaw("LOWER(COALESCE(status, '')) NOT LIKE '%closed%'")),
            ],
            'week_start' => [
                'required',
                'date_format:Y-m-d',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $timestamp = is_string($value) ? strtotime($value) : false;

                    if ($timestamp === false || date('N', $timestamp) !== '1') {
                        $fail('Săptămâna trebuie să înceapă luni.');
                    }
                },
            ],
            'selected' => ['required', 'boolean'],
            'allocations' => ['present', 'array', 'max:100'],
            'allocations.*.person_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('people', 'id')->where(fn ($query) => $query
                    ->where('active', true)
                    ->where('is_external', false)
                    ->when($allowedResourceNames !== [], fn ($people) => $people->whereIn('name', $allowedResourceNames))),
            ],
            'allocations.*.hours' => ['required', 'numeric', 'min:0', 'max:168'],
            'version' => ['present', 'nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array{
     *     project_id: int,
     *     click_up_task_id: int,
     *     week_start: string,
     *     selected: bool,
     *     allocations: list<array{person_id: int, hours: float}>,
     *     version: int|null
     * }
     */
    public function payload(): array
    {
        $validated = $this->validated();
        $allocations = [];
        $validatedAllocations = $validated['allocations'] ?? [];

        if (is_array($validatedAllocations)) {
            foreach ($validatedAllocations as $allocation) {
                if (! is_array($allocation)) {
                    continue;
                }

                $allocations[] = [
                    'person_id' => (int) ($allocation['person_id'] ?? 0),
                    'hours' => (float) ($allocation['hours'] ?? 0),
                ];
            }
        }

        $payload = [
            'project_id' => (int) $validated['project_id'],
            'click_up_task_id' => (int) $validated['click_up_task_id'],
            'week_start' => (string) $validated['week_start'],
            'selected' => (bool) $validated['selected'],
            'allocations' => $allocations,
            'version' => isset($validated['version']) ? (int) $validated['version'] : null,
        ];

        return $payload;
    }
}
