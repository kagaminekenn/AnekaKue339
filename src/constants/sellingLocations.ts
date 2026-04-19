export const SELLING_LOCATIONS = ['Menara Brilian', 'Wisma GKBI'] as const;

export type SellingLocation = (typeof SELLING_LOCATIONS)[number];
