import {
  DEFAULT_DELIVERY_DESTINATION,
  DEFAULT_DELIVERY_TYPE,
  DELIVERY_DESTINATION_OPTIONS,
  DELIVERY_TYPE_OPTIONS,
} from '../constants/salesOrder';

export const formatDeliveryDateTime = (dateTimeString: string | null) => {
  if (!dateTimeString) {
    return {
      date: '-',
      time: '-',
    };
  }

  const date = new Date(dateTimeString);

  if (Number.isNaN(date.getTime())) {
    return {
      date: '-',
      time: '-',
    };
  }

  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return {
    date: dateFormatter.format(date),
    time: timeFormatter.format(date),
  };
};

export const toLocalWhatsappFromRecord = (value: string) => {
  const compact = value.replace(/[^\d+]/g, '');
  let localNumber = compact.replace(/^\+?62/, '');

  if (localNumber.startsWith('0')) {
    localNumber = localNumber.slice(1);
  }

  return localNumber.replace(/\D/g, '');
};

export const randomRowId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const formatDateTimeForStorage = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const localDateTimeToUtcIso = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
};

export const parseDeliveryTypeValue = (value: string | null | undefined) => {
  if (!value) {
    return {
      type: DEFAULT_DELIVERY_TYPE,
      destination: DEFAULT_DELIVERY_DESTINATION,
    };
  }

  const matched = value.match(/^(.*)\s+\((.*)\)$/);
  if (!matched) {
    return {
      type: DEFAULT_DELIVERY_TYPE,
      destination: DEFAULT_DELIVERY_DESTINATION,
    };
  }

  const typeCandidate = matched[1]?.trim() ?? '';
  const destinationCandidate = matched[2]?.trim() ?? '';
  const parsedType = DELIVERY_TYPE_OPTIONS.find((option) => option === typeCandidate) ?? DEFAULT_DELIVERY_TYPE;
  const destinations = DELIVERY_DESTINATION_OPTIONS[parsedType] ?? [];
  const parsedDestination = destinations.find((item) => item === destinationCandidate) ?? destinations[0] ?? DEFAULT_DELIVERY_DESTINATION;

  return {
    type: parsedType,
    destination: parsedDestination,
  };
};
