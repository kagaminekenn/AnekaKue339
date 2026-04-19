export type ModalMode = 'add' | 'edit';

export interface OfficePricingItem {
  id: number;
  item_id: number;
  selling_location: string;
  selling_price: number;
  profit: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  item_name: string | null;
}

export interface ItemOption {
  id: number;
  name: string;
  base_price: number;
}

export interface ItemSelectOption {
  value: string;
  label: string;
  basePrice: number;
}

export interface LocationSelectOption {
  value: string;
  label: string;
}

export interface OfficePricingFormData {
  item_id: string;
  selling_location: string;
  selling_price: string;
  profit: string;
  start_date: string;
  end_date: string;
  is_active: boolean | null;
}

export interface OfficePricingFormErrors {
  item_id?: string;
  selling_location?: string;
  selling_price?: string;
  profit?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}

export interface OfficePricingQueryResult {
  records: OfficePricingItem[];
  totalItems: number;
}

export const DEFAULT_OFFICE_PRICING_FORM_DATA: OfficePricingFormData = {
  item_id: '',
  selling_location: '',
  selling_price: '',
  profit: '',
  start_date: '',
  end_date: '',
  is_active: true,
};
