<?php

namespace App\Http\Requests;

use App\Enums\PermissionName;
use App\Models\Person;
use App\Models\Project;
use App\Services\TeamLead\TeamLeadPlanData;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
            'effective_date' => ['required', 'date_format:Y-m-d'],
            'hours_delta' => ['required', 'numeric', 'between:-744,744', 'not_in:0,0.0,0.00'],
            'reason' => ['required', 'string', 'min:3', 'max:1000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'internal_label.required_without' => __('messages.adjustments.internal_label_required'),
            'effective_date.date_format' => __('messages.adjustments.invalid_date'),
            'hours_delta.not_in' => __('messages.adjustments.non_zero_hours'),
        ];
    }

    /** @return array<callable(Validator): void> */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->has('effective_date')) {
                    return;
                }

                $effectiveDate = CarbonImmutable::createFromFormat(
                    '!Y-m-d',
                    $this->string('effective_date')->toString(),
                );

                if (! in_array($effectiveDate->format('Y-m'), app(TeamLeadPlanData::class)->monthKeys(), true)) {
                    $validator->errors()->add(
                        'effective_date',
                        __('messages.adjustments.date_outside_active_period'),
                    );
                }
            },
        ];
    }
}
