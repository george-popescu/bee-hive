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

class ClearWeeklyPlanningRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && $user->can(PermissionName::ManagePmPlanning->value)
            && in_array((int) $this->input('project_id'), app(PmBoardScope::class)->projectIds($user), true);
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'project_id' => [
                'required',
                'integer',
                Rule::exists((new Project)->getTable(), 'id')
                    ->where('contract_type', ProjectBoardTemplate::Deliverables->value),
            ],
            'week_start' => [
                'required',
                'date_format:Y-m-d',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $timestamp = is_string($value) ? strtotime($value) : false;

                    if ($timestamp === false || date('N', $timestamp) !== '1') {
                        $fail(__('messages.pm_board.week_must_start_on_monday'));
                    }
                },
            ],
        ];
    }

    /** @return array{project_id: int, week_start: string} */
    public function payload(): array
    {
        $validated = $this->validated();

        return [
            'project_id' => (int) $validated['project_id'],
            'week_start' => (string) $validated['week_start'],
        ];
    }
}
