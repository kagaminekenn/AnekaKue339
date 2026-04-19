import type { ClassNamesConfig } from 'react-select';
import type {
  OfficePricingFormData,
  OfficePricingFormErrors,
} from '../types/officePricing';

export const validateOfficePricingAddForm = (formData: OfficePricingFormData): OfficePricingFormErrors => {
  const nextErrors: OfficePricingFormErrors = {};

  if (!formData.item_id) {
    nextErrors.item_id = 'Item is required.';
  }

  if (!formData.selling_location.trim()) {
    nextErrors.selling_location = 'Selling Location is required.';
  }

  if (!formData.selling_price.trim()) {
    nextErrors.selling_price = 'Selling Price is required.';
  }

  if (!formData.start_date) {
    nextErrors.start_date = 'Start Date is required.';
  }

  return nextErrors;
};

export const validateOfficePricingEditForm = (formData: OfficePricingFormData): OfficePricingFormErrors => {
  const nextErrors: OfficePricingFormErrors = {};

  if (!formData.end_date) {
    nextErrors.end_date = 'End Date is required.';
  }

  if (typeof formData.is_active !== 'boolean') {
    nextErrors.status = 'Status is required.';
  }

  if (formData.start_date && formData.end_date && formData.end_date <= formData.start_date) {
    nextErrors.end_date = 'End Date must be later than Start Date.';
  }

  return nextErrors;
};

export const renderHighlightedLabel = (label: string, keyword: string) => {
  if (!keyword.trim()) {
    return label;
  }

  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = label.split(new RegExp(`(${escapedKeyword})`, 'ig'));

  return parts.map((part, index) => {
    if (part.toLowerCase() === keyword.toLowerCase()) {
      return (
        <mark key={`${part}-${index}`} className="rounded bg-amber-100 px-0.5 text-slate-900">
          {part}
        </mark>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
};

export const getReactSelectClassNames = <TOption,>(
  hasError: boolean,
  isDisabled: boolean,
): ClassNamesConfig<TOption, false> => ({
  control: (state) =>
    `!min-h-[42px] !rounded-md !border !cursor-pointer ${
      hasError
        ? '!border-red-500 !ring-2 !ring-red-200'
        : state.isFocused
          ? '!border-blue-500 !ring-2 !ring-blue-200'
          : '!border-slate-300'
    } ${isDisabled ? '!cursor-not-allowed !bg-slate-100 !text-slate-500' : '!bg-white !text-slate-900'}`,
  menu: () => '!z-[60] !mt-1 !overflow-hidden !rounded-md !border !border-slate-200 !shadow-lg',
  option: (state) =>
    `!cursor-pointer !px-3 !py-2 !text-sm ${
      state.isFocused ? '!bg-blue-50 !text-blue-700' : '!bg-white !text-slate-900'
    }`,
  valueContainer: () => '!px-3 !py-0',
  placeholder: () => '!text-slate-400',
  input: () => '!text-slate-900',
  singleValue: () => '!text-slate-900',
  indicatorsContainer: () => '!*:text-slate-500',
});
