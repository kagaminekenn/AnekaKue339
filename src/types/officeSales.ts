export type SortDirection = 'asc' | 'desc';

export type SortKey =
  | 'sales_date'
  | 'selling_location'
  | 'total_stocks'
  | 'total_solds'
  | 'total_leftovers'
  | 'total_cost'
  | 'total_revenue'
  | 'total_loss'
  | 'is_saved'
  | 'net_income';

export type DetailSortKey =
  | 'item_name'
  | 'stocks'
  | 'solds'
  | 'leftovers'
  | 'is_ordered'
  | 'is_free'
  | 'total_cost'
  | 'total_revenue'
  | 'total_loss'
  | 'net_income';

export interface OfficeSalesRecord {
  id: number;
  sales_date: string;
  selling_location: string;
  total_stocks: number;
  total_solds: number;
  total_leftovers: number;
  total_cost: number;
  total_revenue: number;
  total_loss: number | null;
  is_saved: boolean;
  created_date: string;
  updated_date: string | null;
  user_update: string;
  net_income: number;
}

export interface OfficeSalesQueryResult {
  records: OfficeSalesRecord[];
  totalItems: number;
}

export interface OfficeSalesDetailRecord {
  id: number;
  office_sales_id: number;
  office_pricing_id: number;
  stocks: number;
  solds: number;
  leftovers: number | null;
  is_ordered: boolean;
  is_free: boolean;
  total_cost: number;
  total_revenue: number;
  total_loss: number | null;
  net_income: number;
  created_date: string;
  updated_date: string | null;
  user_update: string;
  pricing_profit: number;
  pricing_selling_price: number;
  item_name: string;
  item_base_price: number;
}

export interface OfficeSalesDetailQueryResult {
  records: OfficeSalesDetailRecord[];
  totalItems: number;
}

export interface AddFormItem {
  id: string;
  office_pricing_id: string;
  stocks: number;
  solds: number;
  leftovers: number;
  is_ordered: boolean;
  is_free: boolean;
}

export interface AddFormData {
  sales_date: string;
  selling_location: string;
}

export interface AddOfficePricingRow {
  id: number;
  item_id: number;
  selling_location: string;
  selling_price: number;
  profit: number;
  start_date: string;
  end_date: string | null;
  item_name: string;
  is_active: boolean;
}

export interface AddItemBasePriceRow {
  id: number;
  base_price: number;
}

export interface AddOfficePricingOption {
  value: string;
  label: string;
  office_pricing_id: number;
  item_id: number;
  base_price: number;
  selling_price: number;
  profit: number;
}
