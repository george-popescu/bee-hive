<?php

namespace App\Http\Requests;

use App\Enums\PermissionName;
use App\Models\Person;
use App\Models\Project;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ViewPmBoardRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::ViewPmBoards->value) === true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'project' => ['nullable', 'integer', Rule::exists((new Project)->getTable(), 'id')],
            'selection' => ['nullable', Rule::in(['custom'])],
            'projects' => ['nullable', 'array'],
            'projects.*' => ['integer', 'distinct', Rule::exists((new Project)->getTable(), 'id')],
            'include_internal' => ['nullable', 'boolean'],
            'pm' => ['nullable', 'integer', Rule::exists((new Person)->getTable(), 'id')],
            'period' => ['nullable', Rule::in(['week', 'month'])],
            'anchor' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}
