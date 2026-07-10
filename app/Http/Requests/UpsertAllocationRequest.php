<?php

namespace App\Http\Requests;

use App\Enums\PermissionName;
use App\Models\Person;
use App\Models\Project;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertAllocationRequest extends FormRequest
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
            'project_id' => [
                'required',
                'integer',
                Rule::exists((new Project)->getTable(), 'id')->where('active', true),
            ],
            'role' => ['nullable', 'string', 'max:80'],
            'month' => ['required', 'date_format:Y-m'],
            'planned_hours' => ['required', 'numeric', 'min:0', 'max:999999.99', 'multiple_of:0.25'],
        ];
    }
}
