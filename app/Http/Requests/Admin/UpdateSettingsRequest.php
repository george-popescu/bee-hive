<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
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
            'default_monthly_capacity_hours' => ['required', 'numeric', 'min:1', 'max:744'],
            'hours_per_leave_day' => ['required', 'numeric', 'min:0.25', 'max:24'],
            'active_period_start' => ['nullable', 'date_format:Y-m'],
            'active_period_end' => ['nullable', 'date_format:Y-m', 'after_or_equal:active_period_start'],
        ];
    }
}
