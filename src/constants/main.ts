
const baseUrl = 'https://kkancpslpmlbmgjczyaj.supabase.co/rest/v1';

export const OFFICE_SALES_API_URL = `${baseUrl}/office_sales`;
export const OFFICE_SALES_DETAIL_API_URL = `${baseUrl}/office_sales_detail_view`;
export const OFFICE_SALES_DETAIL_WRITE_API_URL = `${baseUrl}/office_sales_detail`;

export const ADD_ITEMS_PAGE_SIZE = 3;

export const SELLING_LOCATIONS = ['Menara Brilian', 'Wisma GKBI'] as const;

export type SellingLocation = (typeof SELLING_LOCATIONS)[number];

