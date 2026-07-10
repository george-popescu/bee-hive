<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePersonRequest extends FormRequest
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
            'job_role' => ['nullable', 'string', 'max:100'],
            'default_monthly_capacity_hours' => ['required', 'numeric', 'min:0', 'max:744'],
            'weekly_capacity_hours' => ['nullable', 'numeric', 'min:0', 'max:168'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'active' => ['required', 'boolean'],
        ];
    }
}
