import { toJpeg } from 'html-to-image';
import type { ItemFormData, ItemFormErrors } from '../types/items';

type DownloadElementAsImageOptions = {
  elementId: string;
  fileName: string;
  minWidth?: number;
  quality?: number;
};

const REPORT_EXPORT_BACKGROUND = '#ffffff';

const normalizeCloneForImageExport = (rootElement: HTMLElement) => {
  rootElement.style.width = '100%';
  rootElement.style.maxWidth = 'none';
  rootElement.style.margin = '0';
  rootElement.style.backgroundColor = REPORT_EXPORT_BACKGROUND;
  rootElement.style.overflow = 'visible';
  rootElement.style.transform = 'none';
  rootElement.style.boxShadow = 'none';
  rootElement.style.borderRadius = '0';

  rootElement.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.style.animation = 'none';
    element.style.transition = 'none';
    element.style.caretColor = 'transparent';

    if (element.tagName === 'TABLE') {
      element.style.width = '100%';
      element.style.maxWidth = 'none';
      element.style.borderCollapse = 'collapse';
    }

    if (element.tagName === 'TH' || element.tagName === 'TD') {
      element.style.wordBreak = 'break-word';
      element.style.whiteSpace = 'normal';
    }

    if (element.style.overflowX === 'auto' || element.style.overflowX === 'scroll') {
      element.style.overflowX = 'visible';
    }

    if (element.style.overflowY === 'auto' || element.style.overflowY === 'scroll') {
      element.style.overflowY = 'visible';
    }
  });
};

const waitForImageLayout = async () => {
  if ('fonts' in document) {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
};

export const downloadElementAsJpg = async ({
  elementId,
  fileName,
  minWidth = 960,
  quality = 0.9,
}: DownloadElementAsImageOptions) => {
  const sourceElement = document.getElementById(elementId);
  if (!sourceElement) {
    throw new Error('Konten report tidak ditemukan.');
  }

  const clonedElement = sourceElement.cloneNode(true) as HTMLElement;
  normalizeCloneForImageExport(clonedElement);

  const sourceRect = sourceElement.getBoundingClientRect();
  const exportWidth = Math.max(
    Math.ceil(sourceElement.scrollWidth),
    Math.ceil(sourceRect.width),
    minWidth,
  );

  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'fixed';
  tempContainer.style.left = '0';
  tempContainer.style.top = '0';
  tempContainer.style.width = `${exportWidth}px`;
  tempContainer.style.padding = '0';
  tempContainer.style.margin = '0';
  tempContainer.style.backgroundColor = REPORT_EXPORT_BACKGROUND;
  tempContainer.style.pointerEvents = 'none';
  tempContainer.style.zIndex = '-1';
  tempContainer.style.overflow = 'visible';
  clonedElement.style.width = `${exportWidth}px`;
  tempContainer.appendChild(clonedElement);

  document.body.appendChild(tempContainer);

  try {
    await waitForImageLayout();

    const canvasWidth = Math.max(
      exportWidth,
      Math.ceil(tempContainer.scrollWidth),
      Math.ceil(clonedElement.scrollWidth),
    );
    const canvasHeight = Math.max(
      Math.ceil(tempContainer.scrollHeight),
      Math.ceil(clonedElement.scrollHeight),
    );

    if (canvasWidth <= 0 || canvasHeight <= 0) {
      throw new Error('Konten report tidak memiliki ukuran yang valid untuk diexport.');
    }

    const dataUrl = await toJpeg(clonedElement, {
      quality,
      cacheBust: true,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: REPORT_EXPORT_BACKGROUND,
      canvasWidth,
      canvasHeight,
      skipAutoScale: true,
    });

    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = fileName.endsWith('.jpg') ? fileName : `${fileName}.jpg`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    document.body.removeChild(tempContainer);
  }
};

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
