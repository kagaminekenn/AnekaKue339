import type { ItemFormData, ItemFormErrors } from '../types/items';

export const PAGE_SIZE = 10;

export const DEFAULT_ITEM_FORM_DATA: ItemFormData = {
  name: '',
  base_price: '',
  start_date: '',
  end_date: ''
};

export const formatDisplayDate = (dateString: string | null, locale = 'en-GB') => {
  if (!dateString) return '-';

  return new Date(dateString).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

export const formatPriceInput = (value: string) => {
  const numericValue = value.replace(/[^\d]/g, '');
  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parsePriceInput = (value: string) => {
  const numericValue = value.replace(/[^\d]/g, '');
  return Number.parseInt(numericValue || '0', 10);
};

export const validateItemForm = (formData: ItemFormData): ItemFormErrors => {
  const nextErrors: ItemFormErrors = {};

  if (!formData.name.trim()) {
    nextErrors.name = 'Name is required.';
  }

  if (!formData.base_price.trim()) {
    nextErrors.base_price = 'Base Price is required.';
  }

  if (!formData.start_date) {
    nextErrors.start_date = 'Start Date is required.';
  }

  return nextErrors;
};

export const isDateRangeInvalid = (startDate: string, endDate: string) =>
  Boolean(startDate) && Boolean(endDate) && startDate > endDate;
