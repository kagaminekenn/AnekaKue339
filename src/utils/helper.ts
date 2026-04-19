import type { ItemFormData, ItemFormErrors } from '../types/items';

export const PAGE_SIZE = 5;

export const DEFAULT_ITEM_FORM_DATA: ItemFormData = {
  name: '',
  base_price: '',
  start_date: '',
  end_date: '',
  is_active: true
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

export const formatCurrency = (value: number | null) => {
  if (value === null) return '-';
  return `Rp ${value.toLocaleString('id-ID')}`;
};

export const parseNumberInput = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : Math.max(parsed, 0);
};

export const toNullIfZero = (value: number) => (value === 0 ? null : value);

export const getStatusBadgeClassName = (value: boolean, trueTone: string, falseTone: string) =>
  `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${value ? trueTone : falseTone}`;

export const validateEditItemForm = (formData: ItemFormData): ItemFormErrors => {
  const nextErrors: ItemFormErrors = {};

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

export const isDateRangeInvalid = (startDate: string, endDate: string) =>
  Boolean(startDate) && Boolean(endDate) && startDate > endDate;

export const getNextDateValue = (dateString: string) => {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);

  return date.toISOString().split('T')[0];
};
