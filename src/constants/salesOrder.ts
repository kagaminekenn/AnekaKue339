export type DeliveryType = 'Online Delivery' | 'Kurir 339' | 'Pickup';

export const PLACEHOLDER_WORDS = ['Name', 'Whatsapp'];

export const ORDER_DETAIL_EXCLUDED_FIELDS = new Set([
  'id',
  'created_date',
  'updated_date',
  'user_update',
  'is_paid',
  'is_delivered',
]);

export const TABLE_PAGE_SIZE = 3;

export const DELIVERY_TYPE_OPTIONS: DeliveryType[] = ['Online Delivery', 'Kurir 339', 'Pickup'];

export const DELIVERY_DESTINATION_OPTIONS: Record<DeliveryType, string[]> = {
  'Online Delivery': ['339', 'Customer'],
  'Kurir 339': ['Jatiasih', 'Cipendawa', 'Menara Brilian', 'Wisma GKBI'],
  Pickup: ['Jatiasih', 'Cipendawa', 'Menara Brilian', 'Wisma GKBI'],
};

export const DEFAULT_DELIVERY_TYPE = DELIVERY_TYPE_OPTIONS[0];
export const DEFAULT_DELIVERY_DESTINATION = DELIVERY_DESTINATION_OPTIONS[DEFAULT_DELIVERY_TYPE][0] ?? '';
