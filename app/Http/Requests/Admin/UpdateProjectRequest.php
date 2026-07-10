<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionName;
use App\Enums\ProjectBoardTemplate;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProjectRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::ManageSettings->value) === true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'contract_type' => ['required', Rule::enum(ProjectBoardTemplate::class)],
            'board_visible' => ['required', 'boolean'],
            'active' => ['required', 'boolean'],
            'manager_ids' => ['present', 'array', 'max:20'],
            'manager_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('people', 'id')->where(fn ($query) => $query->where('active', true)->where('is_external', false)),
            ],
            'excluded_task_ids' => ['present', 'array', 'max:100'],
            'excluded_task_ids.*' => ['string', 'max:64', 'distinct'],
            'allowed_resource_names' => ['present', 'array', 'max:100'],
            'allowed_resource_names.*' => [
                'string',
                'max:255',
                'distinct',
                Rule::exists('people', 'name')->where(
                    fn ($query) => $query->where('active', true)->where('is_external', false),
                ),
            ],
        ];
    }
}
