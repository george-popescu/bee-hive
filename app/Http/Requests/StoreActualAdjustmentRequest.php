<?php

namespace App\Http\Requests;

use App\Enums\PermissionName;
use App\Models\Person;
use App\Models\Project;
use App\Services\TeamLead\TeamLeadPlanData;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreActualAdjustmentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::AdjustActualHours->value) === true;
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
                'nullable',
                'integer',
                Rule::exists((new Project)->getTable(), 'id')->where('active', true),
            ],
            'internal_label' => ['nullable', 'required_without:project_id', 'string', 'max:120'],
            'month' => ['required', 'date_format:Y-m', Rule::in(app(TeamLeadPlanData::class)->monthKeys())],
            'hours_delta' => ['required', 'numeric', 'between:-744,744', 'not_in:0,0.0,0.00'],
            'reason' => ['required', 'string', 'min:3', 'max:1000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'internal_label.required_without' => 'Eticheta activității interne este obligatorie.',
            'month.in' => 'Luna trebuie să fie în perioada activă de planificare.',
            'hours_delta.not_in' => 'Ajustarea trebuie să modifice numărul de ore.',
        ];
    }
}
