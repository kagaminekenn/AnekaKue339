export interface Item {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  base_price: number;
}

export interface ItemFormData {
  name: string;
  base_price: string;
  start_date: string;
  end_date: string;
}

export interface ItemFormErrors {
  name?: string;
  base_price?: string;
  start_date?: string;
}
