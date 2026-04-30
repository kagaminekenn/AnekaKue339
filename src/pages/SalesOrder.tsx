import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { BanknoteArrowUp, BanknoteX, CalendarDays, CheckCircle2, Clock3, Download, Eye, EyeOff, FileText, Minus, MinusCircle, PackageCheck, PackageX, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp, X, XCircle, Send } from 'lucide-react';
import Select, { type InputActionMeta, type SingleValue } from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Pagination from '../components/Pagination';
import { ADD_ITEMS_PAGE_SIZE } from '../constants/main';
import {
  DEFAULT_DELIVERY_DESTINATION,
  DEFAULT_DELIVERY_TYPE,
  DELIVERY_DESTINATION_OPTIONS,
  DELIVERY_TYPE_OPTIONS,
  ORDER_DETAIL_EXCLUDED_FIELDS,
  PLACEHOLDER_WORDS,
  TABLE_PAGE_SIZE,
  type DeliveryType,
} from '../constants/salesOrder';
import { downloadElementAsJpg, formatCurrency, formatPriceInput, parseNumberInput, parsePriceInput } from '../utils/helper';
import { getReactSelectClassNames, renderHighlightedLabel } from '../utils/officePricing';
import {
  formatDateTimeForStorage,
  formatDeliveryDateTime,
  localDateTimeToUtcIso,
  parseDeliveryTypeValue,
  randomRowId,
  toLocalWhatsappFromRecord,
} from '../utils/salesOrder';
import { supabase } from '../utils/supabase';

type OrderSalesRecord = {
  id: number;
  name: string;
  whatsapp: string;
  delivery_datetime: string | null;
  delivery_address: string | null;
  delivery_type: string | null;
  delivery_cost: number | null;
  is_paid: boolean | null;
  is_delivered: boolean | null;
  total_items: number;
  total_price: number;
  remark: string | null;
};

type OrderSalesQueryResult = {
  records: OrderSalesRecord[];
  totalItems: number;
};

type OrderSalesDetailRecord = Record<string, unknown>;

type OrderSalesDetailItemViewRecord = {
  id: number;
  order_sales_id: number;
  order_pricing_id: number;
  quantity: number;
  total_price: number;
  total_cost: number;
  is_free: boolean | null;
  net_income: number;
  selling_price: number;
  profit: number;
  item_name: string;
  base_price: number;
};

type OrderSalesDetailItemsQueryResult = {
  records: OrderSalesDetailItemViewRecord[];
  totalItems: number;
};

type LoyalCustomerRecord = {
  id: number;
  name: string;
  whatsapp: string;
  address: string;
};

type AddOrderPricingRow = {
  id: number;
  item_id: number;
  item_name: string;
  min_order: number;
  selling_price: number;
  profit: number;
  is_active: boolean;
};

type AddItemBasePriceRow = {
  id: number;
  base_price: number;
};

type AddProductOption = {
  value: string;
  label: string;
  order_pricing_id: number;
  item_id: number;
  min_order: number;
  selling_price: number;
  profit: number;
};

type AddFormItem = {
  id: string;
  quantity: number;
  order_pricing_id: string;
  is_free: boolean;
};

type AddFormData = {
  customer_name: string;
  whatsapp: string;
  delivery_datetime: string;
  delivery_address: string;
  delivery_type: DeliveryType;
  delivery_destination: string;
  remark: string;
  delivery_cost: string;
  is_paid: boolean;
  is_delivered: boolean;
};

type ModalMode = 'add' | 'edit';

type EditableOrderSalesRecord = {
  id: number;
  name: string;
  whatsapp: string;
  delivery_datetime: string;
  delivery_address: string;
  delivery_type: string;
  remark: string | null;
  delivery_cost: number | null;
  is_paid: boolean;
  is_delivered: boolean;
};

type EditableOrderSalesDetailRecord = {
  id: number;
  order_sales_id: number;
  order_pricing_id: number;
  quantity: number;
  is_free: boolean;
};

type CustomerMode = 'existing' | 'new';

type SimpleSelectOption = {
  value: string;
  label: string;
};

type PlaceholderPhase = 'typing' | 'pausing' | 'deleting';
type SortField = 'name' | 'whatsapp' | 'delivery_datetime' | 'delivery_type' | 'total_items' | 'total_price' | 'is_paid' | 'is_delivered';
type SortDirection = 'asc' | 'desc';

const DEFAULT_ADD_FORM_DATA: AddFormData = {
  customer_name: '',
  whatsapp: '',
  delivery_datetime: '',
  delivery_address: '',
  delivery_type: DEFAULT_DELIVERY_TYPE,
  delivery_destination: DEFAULT_DELIVERY_DESTINATION,
  remark: '',
  delivery_cost: '',
  is_paid: false,
  is_delivered: false,
};

const StatusIcon = ({ value, label }: { value: boolean | null; label: string }) => {
  const isPaid = label.toLowerCase() === 'paid';
  const isDelivered = label.toLowerCase() === 'delivered';

  if (value === true) {
    return (
      <span title={`${label}: Yes`} aria-label={`${label}: Yes`}>
        {isPaid ? <BanknoteArrowUp className="h-5 w-5 text-emerald-600" /> : isDelivered ? <PackageCheck className="h-5 w-5 text-emerald-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
      </span>
    );
  }

  if (value === false) {
    return (
      <span title={`${label}: No`} aria-label={`${label}: No`}>
        {isPaid ? <BanknoteX className="h-5 w-5 text-rose-600" /> : isDelivered ? <PackageX className="h-5 w-5 text-rose-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
      </span>
    );
  }

  return (
    <span title={`${label}: Unknown`} aria-label={`${label}: Unknown`}>
      <MinusCircle className="h-5 w-5 text-slate-400" />
    </span>
  );
};

const OrderStatusBadge = ({ isPaid, isDelivered }: { isPaid: boolean | null; isDelivered: boolean | null }) => {
  const paid = isPaid === true;
  const delivered = isDelivered === true;

  if (paid && delivered) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Done
      </span>
    );
  }

  if (paid && !delivered) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
        <PackageX className="h-3.5 w-3.5" />
        Pending Delivery
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">
      <BanknoteX className="h-3.5 w-3.5" />
      Pending Payment
    </span>
  );
};

const SalesOrder = () => {
  const queryClient = useQueryClient();
  const [ongoingCurrentPage, setOngoingCurrentPage] = useState(1);
  const [pastOrdersCurrentPage, setPastOrdersCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const sortField: SortField = 'delivery_datetime';
  const sortDirection: SortDirection = 'desc';
  const [isPastOrdersOpen, setIsPastOrdersOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);
  const [isAddSensorOn, setIsAddSensorOn] = useState(true);
  const [whatsappPrefixWarning, setWhatsappPrefixWarning] = useState(false);
  const [customerSearchKeyword, setCustomerSearchKeyword] = useState('');
  const [deliveryTypeSearchKeyword, setDeliveryTypeSearchKeyword] = useState('');
  const [deliveryDestinationSearchKeyword, setDeliveryDestinationSearchKeyword] = useState('');
  const [productSearchKeyword, setProductSearchKeyword] = useState<Record<string, string>>({});
  const [addItemsCurrentPage, setAddItemsCurrentPage] = useState(1);
  const [addFormData, setAddFormData] = useState<AddFormData>(DEFAULT_ADD_FORM_DATA);
  const [addFormItems, setAddFormItems] = useState<AddFormItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detailCurrentPage, setDetailCurrentPage] = useState(1);
  const [isDetailSensorOn, setIsDetailSensorOn] = useState(true);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState('Admin 339');
  const [reportRecord, setReportRecord] = useState<OrderSalesRecord | null>(null);
  const [reportTabIndex, setReportTabIndex] = useState<'receipt' | 'cost'>('receipt');
  const [placeholderWordIndex, setPlaceholderWordIndex] = useState(0);
  const [placeholderCharCount, setPlaceholderCharCount] = useState(0);
  const [placeholderPhase, setPlaceholderPhase] = useState<PlaceholderPhase>('typing');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {}, onCancel: () => {} });

  const closeConfirm = () => {
    setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {}, onCancel: () => {} });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, message, onConfirm, onCancel: () => {} });
  };

  const confirmAsync = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        message,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  };

  const resetAddForm = () => {
    setModalMode('add');
    setEditingOrderId(null);
    setIsEditLoading(false);
    setCustomerMode('existing');
    setSelectedCustomerId('');
    setAddFormData(DEFAULT_ADD_FORM_DATA);
    setAddFormItems([]);
    setAddItemsCurrentPage(1);
    setIsAddSensorOn(true);
    setWhatsappPrefixWarning(false);
    setCustomerSearchKeyword('');
    setDeliveryTypeSearchKeyword('');
    setDeliveryDestinationSearchKeyword('');
    setProductSearchKeyword({});
  };

  const handleOpenAddModal = () => {
    resetAddForm();
    setModalMode('add');
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    if (isAddSubmitting) {
      return;
    }

    if (addFormItems.length > 0) {
      showConfirm('You have unsaved data. Are you sure you want to close?', () => {
        setIsAddModalOpen(false);
        resetAddForm();
      });
      return;
    }

    setIsAddModalOpen(false);
    resetAddForm();
  };

  const handleOpenEditModal = async (orderId: number) => {
    resetAddForm();
    setModalMode('edit');
    setEditingOrderId(orderId);
    setCustomerMode('new');
    setIsAddModalOpen(true);
    setIsEditLoading(true);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('order_sales')
        .select('id,name,whatsapp,delivery_datetime,delivery_address,delivery_type,remark,delivery_cost,is_paid,is_delivered')
        .eq('id', orderId)
        .single();

      if (orderError) {
        throw orderError;
      }

      const { data: detailData, error: detailError } = await supabase
        .from('order_sales_detail')
        .select('id,order_sales_id,order_pricing_id,quantity,is_free')
        .eq('order_sales_id', orderId)
        .order('id', { ascending: true });

      if (detailError) {
        throw detailError;
      }

      const orderRecord = orderData as EditableOrderSalesRecord;
      const detailRecords = (detailData ?? []) as EditableOrderSalesDetailRecord[];
      const parsedDeliveryType = parseDeliveryTypeValue(orderRecord.delivery_type);

      setAddFormData({
        customer_name: orderRecord.name ?? '',
        whatsapp: toLocalWhatsappFromRecord(orderRecord.whatsapp ?? ''),
        delivery_datetime: orderRecord.delivery_datetime ? formatDateTimeForStorage(new Date(orderRecord.delivery_datetime)) : '',
        delivery_address: orderRecord.delivery_address ?? '',
        delivery_type: parsedDeliveryType.type,
        delivery_destination: parsedDeliveryType.destination,
        remark: orderRecord.remark ?? '',
        delivery_cost: orderRecord.delivery_cost !== null ? formatPriceInput(String(orderRecord.delivery_cost)) : '',
        is_paid: Boolean(orderRecord.is_paid),
        is_delivered: Boolean(orderRecord.is_delivered),
      });

      setAddFormItems(
        detailRecords.map((item) => ({
          id: `edit-${item.id}`,
          quantity: item.quantity,
          order_pricing_id: String(item.order_pricing_id),
          is_free: Boolean(item.is_free),
        })),
      );
    } catch (error) {
      console.error('Error loading order sales edit data:', error);
      alert(`Gagal memuat data edit: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsAddModalOpen(false);
      resetAddForm();
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleCustomerModeChange = (mode: CustomerMode) => {
    setCustomerMode(mode);
    setSelectedCustomerId('');
    setAddFormData((prev) => ({
      ...prev,
      customer_name: '',
      whatsapp: '',
      delivery_address: '',
    }));
    setWhatsappPrefixWarning(false);
  };

  const handleAddFormFieldChange = (field: keyof AddFormData, value: string | boolean) => {
    setAddFormData((prev) => ({
      ...prev,
      [field]: value,
    } as AddFormData));
  };

  const handleWhatsappChange = (value: string) => {
    const compact = value.replace(/[\s-]/g, '');
    const hasCountryPrefix = compact.startsWith('+62') || compact.startsWith('62');
    let localNumber = compact.replace(/^\+?62/, '');
    localNumber = localNumber.replace(/\D/g, '');

    setWhatsappPrefixWarning(hasCountryPrefix);
    handleAddFormFieldChange('whatsapp', localNumber);
  };

  const handleDeliveryTypeChange = (value: string) => {
    const typedValue = DELIVERY_TYPE_OPTIONS.find((option) => option === value) ?? DEFAULT_DELIVERY_TYPE;
    const fallbackDestination = DELIVERY_DESTINATION_OPTIONS[typedValue][0] ?? '';

    setAddFormData((prev) => ({
      ...prev,
      delivery_type: typedValue,
      delivery_destination: fallbackDestination,
    }));
  };

  const handleDeliveryDateTimeChange = (date: Date | null) => {
    handleAddFormFieldChange('delivery_datetime', date ? formatDateTimeForStorage(date) : '');
  };

  const handleDeliveryTypeSelectChange = (selected: SingleValue<SimpleSelectOption>) => {
    handleDeliveryTypeChange(selected?.value ?? DEFAULT_DELIVERY_TYPE);
  };

  const handleDeliveryTypeSearchInputChange = (inputValue: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') {
      setDeliveryTypeSearchKeyword(inputValue);
    }

    if (meta.action === 'menu-close' || meta.action === 'set-value') {
      setDeliveryTypeSearchKeyword('');
    }

    return inputValue;
  };

  const handleDeliveryDestinationSelectChange = (selected: SingleValue<SimpleSelectOption>) => {
    handleAddFormFieldChange('delivery_destination', selected?.value ?? '');
  };

  const handleDeliveryDestinationSearchInputChange = (inputValue: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') {
      setDeliveryDestinationSearchKeyword(inputValue);
    }

    if (meta.action === 'menu-close' || meta.action === 'set-value') {
      setDeliveryDestinationSearchKeyword('');
    }

    return inputValue;
  };

  const handleCustomerSearchInputChange = (inputValue: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') {
      setCustomerSearchKeyword(inputValue);
    }

    if (meta.action === 'menu-close' || meta.action === 'set-value') {
      setCustomerSearchKeyword('');
    }

    return inputValue;
  };

  const handleProductSearchInputChange = (rowId: string, inputValue: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') {
      setProductSearchKeyword((prev) => ({
        ...prev,
        [rowId]: inputValue,
      }));
    }

    if (meta.action === 'menu-close' || meta.action === 'set-value') {
      setProductSearchKeyword((prev) => ({
        ...prev,
        [rowId]: '',
      }));
    }

    return inputValue;
  };

  const handleAddRow = () => {
    const newRow: AddFormItem = {
      id: randomRowId('item'),
      quantity: 0,
      order_pricing_id: '',
      is_free: false,
    };

    setAddFormItems((prev) => {
      const next = [...prev, newRow];
      setAddItemsCurrentPage(Math.max(1, Math.ceil(next.length / ADD_ITEMS_PAGE_SIZE)));
      return next;
    });
  };

  const handleRemoveRow = (rowId: string) => {
    setAddFormItems((prev) => {
      const next = prev.filter((item) => item.id !== rowId);
      const totalPages = Math.max(1, Math.ceil(next.length / ADD_ITEMS_PAGE_SIZE));
      setAddItemsCurrentPage((current) => Math.min(current, totalPages));
      return next;
    });
  };

  const handleAddItemChange = (rowId: string, field: keyof AddFormItem, value: string | number | boolean) => {
    setAddFormItems((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) {
          return item;
        }

        const updatedItem = {
          ...item,
          [field]: value,
        } as AddFormItem;

        if (field === 'quantity') {
          if (updatedItem.quantity <= 0) {
            updatedItem.order_pricing_id = '';
            return updatedItem;
          }

          if (updatedItem.order_pricing_id) {
            const selectedPricing = addPricingRows.find((pricing) => String(pricing.id) === updatedItem.order_pricing_id);
            const isQuantityCompatible = selectedPricing ? updatedItem.quantity >= selectedPricing.min_order : false;

            if (!isQuantityCompatible) {
              updatedItem.order_pricing_id = '';
            }
          }
        }

        return updatedItem;
      }),
    );
  };

  const handleOpenDetail = (orderId: number) => {
    setSelectedOrderId(orderId);
    setDetailCurrentPage(1);
    setIsDetailSensorOn(true);
  };

  const handleCloseDetail = () => {
    setSelectedOrderId(null);
    setDetailCurrentPage(1);
  };

  const handleOpenReportModal = (record: OrderSalesRecord) => {
    setReportRecord(record);
    setReportTabIndex('receipt');
  };

  const handleCloseReportModal = () => {
    setReportRecord(null);
  };

  const handleDeleteOrder = async (record: OrderSalesRecord) => {
    if (deletingOrderId !== null) {
      return;
    }

    const isConfirmed = await confirmAsync(
      `Delete order for "${record.name || 'this customer'}"? This action cannot be undone.`,
    );

    if (!isConfirmed) {
      return;
    }

    setDeletingOrderId(record.id);

    try {
      const { error: deleteDetailError } = await supabase
        .from('order_sales_detail')
        .delete()
        .eq('order_sales_id', record.id);

      if (deleteDetailError) {
        throw deleteDetailError;
      }

      const { error: deleteOrderError } = await supabase
        .from('order_sales')
        .delete()
        .eq('id', record.id);

      if (deleteOrderError) {
        throw deleteOrderError;
      }

      if (selectedOrderId === record.id) {
        handleCloseDetail();
      }

      if (reportRecord?.id === record.id) {
        handleCloseReportModal();
      }

      await queryClient.invalidateQueries({ queryKey: ['order-sales'] });
      await queryClient.invalidateQueries({ queryKey: ['order-sales-detail'] });
      await queryClient.invalidateQueries({ queryKey: ['order-sales-detail-items'] });
      await queryClient.invalidateQueries({ queryKey: ['order-sales-report-detail'] });
    } catch (error) {
      console.error('Error deleting order sales:', error);
      alert(`Failed to delete order sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingOrderId(null);
    }
  };

  const waitForNextPaint = async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  };

  const getSafeIsoDate = (value: string | null) => {
    if (!value) {
      return 'unknown';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'unknown';
    }

    return date.toISOString().split('T')[0] ?? 'unknown';
  };

  const formatReceiptDateTimeParts = (deliveryDateTime: string | null) => {
    if (!deliveryDateTime) {
      return {
        date: '-',
        time: '-',
      };
    }

    const date = new Date(deliveryDateTime);
    if (Number.isNaN(date.getTime())) {
      return {
        date: '-',
        time: '-',
      };
    }

    return {
      date: new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(date),
      time: `${new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)} WIB`,
    };
  };

  const reportDateTimeParts = useMemo(
    () => formatReceiptDateTimeParts(reportRecord?.delivery_datetime ?? null),
    [reportRecord?.delivery_datetime],
  );

  const reportDeliveryCost = useMemo(() => {
    if (!reportRecord || reportRecord.delivery_cost === null) {
      return null;
    }

    return reportRecord.delivery_cost;
  }, [reportRecord]);

  const reportFinalPrice = useMemo(
    () => (reportRecord?.total_price ?? 0) + (reportDeliveryCost ?? 0),
    [reportRecord?.total_price, reportDeliveryCost],
  );

  const handleDownloadReceipt = async () => {
    if (!reportRecord) {
      return;
    }

    try {
      setReportTabIndex('receipt');
      await waitForNextPaint();

      const iso = getSafeIsoDate(reportRecord.delivery_datetime);
      await downloadElementAsJpg({
        elementId: 'order-receipt-content',
        fileName: `order_receipt_${reportRecord.name}_${iso}.jpg`,
        minWidth: 1080,
        quality: 0.9,
      });
    } catch (error) {
      alert(`Gagal mengunduh struk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDownloadCostReport = async () => {
    if (!reportRecord) {
      return;
    }

    try {
      setReportTabIndex('cost');
      await waitForNextPaint();

      const iso = getSafeIsoDate(reportRecord.delivery_datetime);
      await downloadElementAsJpg({
        elementId: 'order-cost-content',
        fileName: `order_cost_report_${reportRecord.name}_${iso}.jpg`,
        minWidth: 1080,
        quality: 0.9,
      });
    } catch (error) {
      alert(`Gagal mengunduh laporan biaya: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    const loadCurrentUserDisplayName = async () => {
      const { data } = await supabase.auth.getUser();
      const userMetadata = data.user?.user_metadata;

      if (!userMetadata || typeof userMetadata !== 'object') {
        return;
      }

      const displayName = (userMetadata as { display_name?: unknown }).display_name;
      if (typeof displayName === 'string' && displayName.trim()) {
        setCurrentUserDisplayName(displayName.trim());
      }
    };

    void loadCurrentUserDisplayName();
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
      setOngoingCurrentPage(1);
      setPastOrdersCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!selectedOrderId && !isAddModalOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (isAddModalOpen) {
        handleCloseAddModal();
        return;
      }

      if (selectedOrderId) {
        handleCloseDetail();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [selectedOrderId, isAddModalOpen, isAddSubmitting]);

  useEffect(() => {
    const currentWord = PLACEHOLDER_WORDS[placeholderWordIndex] ?? '';
    let nextDelay = 110;

    if (placeholderPhase === 'pausing') {
      nextDelay = 1100;
    } else if (placeholderPhase === 'deleting') {
      nextDelay = 65;
    }

    const timeoutId = window.setTimeout(() => {
      if (placeholderPhase === 'typing') {
        if (placeholderCharCount < currentWord.length) {
          setPlaceholderCharCount((prev) => prev + 1);
        } else {
          setPlaceholderPhase('pausing');
        }
        return;
      }

      if (placeholderPhase === 'pausing') {
        setPlaceholderPhase('deleting');
        return;
      }

      if (placeholderCharCount > 0) {
        setPlaceholderCharCount((prev) => prev - 1);
        return;
      }

      setPlaceholderWordIndex((prev) => (prev + 1) % PLACEHOLDER_WORDS.length);
      setPlaceholderPhase('typing');
    }, nextDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [placeholderWordIndex, placeholderCharCount, placeholderPhase]);

  const currentPlaceholderWord = PLACEHOLDER_WORDS[placeholderWordIndex] ?? '';
  const animatedPlaceholderText = currentPlaceholderWord.slice(0, placeholderCharCount);

  const { data: orderSalesData, isLoading, isFetching } = useQuery<OrderSalesQueryResult>({
    queryKey: ['order-sales-ongoing', ongoingCurrentPage, searchKeyword, sortField, sortDirection],
    queryFn: async () => {
      const from = (ongoingCurrentPage - 1) * TABLE_PAGE_SIZE;
      const to = from + TABLE_PAGE_SIZE - 1;

      let query = supabase
        .from('order_sales')
        .select('id,name,whatsapp,delivery_datetime,delivery_address,delivery_type,delivery_cost,is_paid,is_delivered,total_items,total_price,remark', {
          count: 'exact',
        })
        .or('is_paid.eq.false,is_delivered.eq.false,is_paid.is.null,is_delivered.is.null')
        .order(sortField, { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });

      if (searchKeyword) {
        const escapedKeyword = searchKeyword.replace(/,/g, '\\,');
        query = query.or(`name.ilike.%${escapedKeyword}%,whatsapp.ilike.%${escapedKeyword}%`);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw error;
      }

      return {
        records: (data ?? []) as OrderSalesRecord[],
        totalItems: count ?? 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: pastOrdersData,
    isLoading: isPastOrdersLoading,
    isFetching: isPastOrdersFetching,
  } = useQuery<OrderSalesQueryResult>({
    queryKey: ['order-sales-past', pastOrdersCurrentPage, searchKeyword, sortField, sortDirection],
    queryFn: async () => {
      const from = (pastOrdersCurrentPage - 1) * TABLE_PAGE_SIZE;
      const to = from + TABLE_PAGE_SIZE - 1;

      let query = supabase
        .from('order_sales')
        .select('id,name,whatsapp,delivery_datetime,delivery_address,delivery_type,delivery_cost,is_paid,is_delivered,total_items,total_price', {
          count: 'exact',
        })
        .eq('is_paid', true)
        .eq('is_delivered', true)
        .order(sortField, { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });

      if (searchKeyword) {
        const escapedKeyword = searchKeyword.replace(/,/g, '\\,');
        query = query.or(`name.ilike.%${escapedKeyword}%,whatsapp.ilike.%${escapedKeyword}%`);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw error;
      }

      return {
        records: (data ?? []) as OrderSalesRecord[],
        totalItems: count ?? 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: loyalCustomersData } = useQuery<LoyalCustomerRecord[]>({
    queryKey: ['order-sales-add-loyal-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyal_customers')
        .select('id,name,whatsapp,address')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as LoyalCustomerRecord[];
    },
    enabled: isAddModalOpen,
    staleTime: 1000 * 60 * 5,
  });

  const { data: addOrderPricingRows } = useQuery<AddOrderPricingRow[]>({
    queryKey: ['order-sales-add-order-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_pricing_view')
        .select('id,item_id,item_name,min_order,selling_price,profit,is_active')
        .eq('is_active', true)
        .order('item_name', { ascending: true })
        .order('min_order', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as AddOrderPricingRow[];
    },
    enabled: isAddModalOpen,
    staleTime: 1000 * 60 * 5,
  });

  const { data: addItemBasePriceRows } = useQuery<AddItemBasePriceRow[]>({
    queryKey: ['order-sales-add-item-base-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id,base_price')
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      return (data ?? []) as AddItemBasePriceRow[];
    },
    enabled: isAddModalOpen,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: selectedOrderDetail,
    isLoading: isOrderDetailLoading,
    isFetching: isOrderDetailFetching,
  } = useQuery<OrderSalesDetailRecord | null>({
    queryKey: ['order-sales-detail', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) {
        return null;
      }

      const { data, error } = await supabase
        .from('order_sales')
        .select('*')
        .eq('id', selectedOrderId)
        .single();

      if (error) {
        throw error;
      }

      return (data ?? null) as OrderSalesDetailRecord | null;
    },
    enabled: selectedOrderId !== null,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: orderSalesDetailItemsData,
    isLoading: isOrderDetailItemsLoading,
    isFetching: isOrderDetailItemsFetching,
  } = useQuery<OrderSalesDetailItemsQueryResult>({
    queryKey: ['order-sales-detail-items', selectedOrderId, detailCurrentPage],
    queryFn: async () => {
      if (!selectedOrderId) {
        return {
          records: [],
          totalItems: 0,
        };
      }

      const from = (detailCurrentPage - 1) * TABLE_PAGE_SIZE;
      const to = from + TABLE_PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('order_sales_detail_view')
        .select('id,order_sales_id,order_pricing_id,quantity,total_price,total_cost,is_free,net_income,selling_price,profit,item_name,base_price', {
          count: 'exact',
        })
        .eq('order_sales_id', selectedOrderId)
        .order('id', { ascending: true })
        .range(from, to);

      if (error) {
        throw error;
      }

      return {
        records: (data ?? []) as OrderSalesDetailItemViewRecord[],
        totalItems: count ?? 0,
      };
    },
    enabled: selectedOrderId !== null,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: reportDetailRecords,
    isLoading: isReportDetailLoading,
    isFetching: isReportDetailFetching,
  } = useQuery<OrderSalesDetailItemViewRecord[]>({
    queryKey: ['order-sales-report-detail', reportRecord?.id],
    queryFn: async () => {
      if (!reportRecord) {
        return [];
      }

      const { data, error } = await supabase
        .from('order_sales_detail_view')
        .select('id,order_sales_id,order_pricing_id,quantity,total_price,total_cost,is_free,net_income,selling_price,profit,item_name,base_price')
        .eq('order_sales_id', reportRecord.id)
        .order('id', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as OrderSalesDetailItemViewRecord[];
    },
    enabled: reportRecord !== null,
    staleTime: 1000 * 60 * 5,
  });

  const ongoingRecords = orderSalesData?.records ?? [];
  const pastOrderRecords = pastOrdersData?.records ?? [];
  const loyalCustomers = loyalCustomersData ?? [];
  const addPricingRows = addOrderPricingRows ?? [];
  const ongoingTotalItems = orderSalesData?.totalItems ?? 0;
  const pastOrdersTotalItems = pastOrdersData?.totalItems ?? 0;
  const totalMatchingItems = ongoingTotalItems + pastOrdersTotalItems;
  const loading = isLoading || isFetching;
  const pastOrdersLoading = isPastOrdersLoading || isPastOrdersFetching;
  const hasKeyword = useMemo(() => searchKeyword.length > 0, [searchKeyword]);
  const detailRecords = orderSalesDetailItemsData?.records ?? [];
  const detailTotalItems = orderSalesDetailItemsData?.totalItems ?? 0;
  const detailLoading = isOrderDetailItemsLoading || isOrderDetailItemsFetching;
  const orderDetailLoading = isOrderDetailLoading || isOrderDetailFetching;
  const detailSensorClass = isDetailSensorOn ? 'select-none blur-sm' : '';
  const addSensorClass = isAddSensorOn ? 'select-none blur-sm' : '';
  const selectPortalTarget = typeof document === 'undefined' ? undefined : document.body;

  const customerOptions = useMemo<SimpleSelectOption[]>(
    () =>
      loyalCustomers.map((customer) => ({
        value: String(customer.id),
        label: customer.name,
      })),
    [loyalCustomers],
  );

  const selectedCustomer = useMemo(
    () => loyalCustomers.find((item) => String(item.id) === selectedCustomerId) ?? null,
    [loyalCustomers, selectedCustomerId],
  );

  const selectedCustomerOption = useMemo(
    () => customerOptions.find((item) => item.value === selectedCustomerId) ?? null,
    [customerOptions, selectedCustomerId],
  );

  const deliveryTypeOptions = useMemo<SimpleSelectOption[]>(
    () => DELIVERY_TYPE_OPTIONS.map((value) => ({ value, label: value })),
    [],
  );

  const selectedDeliveryTypeOption = useMemo(
    () => deliveryTypeOptions.find((option) => option.value === addFormData.delivery_type) ?? null,
    [deliveryTypeOptions, addFormData.delivery_type],
  );

  const deliveryDestinationOptions = useMemo<SimpleSelectOption[]>(
    () =>
      (DELIVERY_DESTINATION_OPTIONS[addFormData.delivery_type] ?? []).map((value) => ({
        value,
        label: value,
      })),
    [addFormData.delivery_type],
  );

  const selectedDeliveryDestinationOption = useMemo(
    () => deliveryDestinationOptions.find((option) => option.value === addFormData.delivery_destination) ?? null,
    [deliveryDestinationOptions, addFormData.delivery_destination],
  );

  const itemBasePriceMap = useMemo(
    () => new Map((addItemBasePriceRows ?? []).map((item) => [item.id, item.base_price])),
    [addItemBasePriceRows],
  );

  const filteredAddProductOptionsByQuantity = useMemo(
    () =>
      addFormItems.reduce<Record<string, AddProductOption[]>>((acc, row) => {
        if (row.quantity <= 0) {
          acc[row.id] = [];
          return acc;
        }

        const filteredRows = addPricingRows.filter((option) => option.min_order <= row.quantity);
        const bestOptionByItemName = filteredRows.reduce<Map<string, AddOrderPricingRow>>((map, rowOption) => {
          const normalizedName = rowOption.item_name.trim().toLowerCase();

          if (!normalizedName) {
            return map;
          }

          const existingOption = map.get(normalizedName);

          if (!existingOption || rowOption.min_order > existingOption.min_order) {
            map.set(normalizedName, rowOption);
          }

          return map;
        }, new Map<string, AddOrderPricingRow>());

        acc[row.id] = Array.from(bestOptionByItemName.values())
          .sort((a, b) => a.item_name.localeCompare(b.item_name, 'id', { sensitivity: 'base' }))
          .map((rowOption) => ({
            value: String(rowOption.id),
            label: rowOption.item_name,
            order_pricing_id: rowOption.id,
            item_id: rowOption.item_id,
            min_order: rowOption.min_order,
            selling_price: rowOption.selling_price,
            profit: rowOption.profit,
          }));

        return acc;
      }, {}),
    [addFormItems, addPricingRows],
  );

  const addProductOptionMap = useMemo(
    () =>
      Object.values(filteredAddProductOptionsByQuantity)
        .flat()
        .reduce((map, option) => map.set(option.value, option), new Map<string, AddProductOption>()),
    [filteredAddProductOptionsByQuantity],
  );

  const getAddProductOption = (orderPricingId: string) => addProductOptionMap.get(orderPricingId) ?? null;

  const getAddItemComputedValues = (item: AddFormItem) => {
    const option = getAddProductOption(item.order_pricing_id);

    if (!option) {
      return {
        sellingPrice: 0,
        totalPrice: 0,
        totalCost: 0,
        netIncome: 0,
      };
    }

    const basePrice = itemBasePriceMap.get(option.item_id) ?? 0;
    const sellingPrice = option.selling_price;
    const totalPrice = item.is_free ? 0 : sellingPrice * item.quantity;
    const totalCost = basePrice * item.quantity;
    const netIncome = totalPrice - totalCost;

    return {
      sellingPrice,
      totalPrice,
      totalCost,
      netIncome,
    };
  };

  const addSummaryTotals = useMemo(() => {
    const summary = addFormItems.reduce(
      (acc, item) => {
        const computed = getAddItemComputedValues(item);

        acc.totalItems += item.quantity;
        acc.totalPrice += computed.totalPrice;
        acc.totalCost += computed.totalCost;
        acc.netIncome += computed.netIncome;

        return acc;
      },
      {
        totalItems: 0,
        totalPrice: 0,
        totalCost: 0,
        netIncome: 0,
      },
    );

    const deliveryCost = parsePriceInput(addFormData.delivery_cost);

    return {
      ...summary,
      deliveryCost,
      finalPrice: summary.totalPrice + deliveryCost,
    };
  }, [addFormItems, addFormData.delivery_cost]);

  const addComputedNetIncome = useMemo(() => {
    const itemNetIncomeTotal = addSummaryTotals.netIncome;

    if (addFormData.delivery_type === 'Kurir 339') {
      return itemNetIncomeTotal + addSummaryTotals.deliveryCost;
    }

    return itemNetIncomeTotal;
  }, [addSummaryTotals.netIncome, addSummaryTotals.deliveryCost, addFormData.delivery_type]);

  const paginatedAddFormItems = useMemo(() => {
    const start = (addItemsCurrentPage - 1) * ADD_ITEMS_PAGE_SIZE;
    const end = start + ADD_ITEMS_PAGE_SIZE;
    return addFormItems.slice(start, end);
  }, [addFormItems, addItemsCurrentPage]);

  useEffect(() => {
    if (customerMode !== 'existing') {
      return;
    }

    if (!selectedCustomer) {
      setAddFormData((prev) => ({
        ...prev,
        customer_name: '',
      }));
      return;
    }

    setAddFormData((prev) => ({
      ...prev,
      customer_name: selectedCustomer.name,
      whatsapp: toLocalWhatsappFromRecord(selectedCustomer.whatsapp),
      delivery_address: selectedCustomer.address ?? '',
    }));
    setWhatsappPrefixWarning(false);
  }, [customerMode, selectedCustomer]);

  const handleExistingCustomerChange = (selected: SingleValue<SimpleSelectOption>) => {
    const nextId = selected?.value ?? '';
    setSelectedCustomerId(nextId);
  };

  const handleProductChange = (rowId: string, selected: SingleValue<AddProductOption>) => {
    handleAddItemChange(rowId, 'order_pricing_id', selected?.value ?? '');
  };

  const handleSubmitAddForm = async () => {
    if (isAddSubmitting) {
      return;
    }

    if (whatsappPrefixWarning) {
      alert('Nomor Whatsapp tidak perlu diawali +62 karena prefix sudah otomatis.');
      return;
    }

    if (!addFormData.customer_name.trim()) {
      alert('Nama customer wajib diisi.');
      return;
    }

    if (!addFormData.whatsapp.trim() || !addFormData.whatsapp.startsWith('8')) {
      alert('Nomor Whatsapp wajib diisi dan harus diawali angka 8.');
      return;
    }

    if (!addFormData.delivery_datetime) {
      alert('Delivery datetime wajib diisi.');
      return;
    }

    if (!addFormData.delivery_address.trim()) {
      alert('Delivery address wajib diisi.');
      return;
    }

    if (addFormItems.length === 0) {
      alert('Tambahkan minimal satu item.');
      return;
    }

    const hasInvalidItem = addFormItems.some((item) => item.quantity <= 0 || !item.order_pricing_id);
    if (hasInvalidItem) {
      alert('Semua row item wajib memiliki quantity lebih dari 0 dan produk terpilih.');
      return;
    }

    const confirmMessage = modalMode === 'edit'
      ? 'Are you sure you want to save changes to this order?'
      : 'Are you sure you want to submit this order?';
    const confirmed = await confirmAsync(confirmMessage);
    if (!confirmed) {
      return;
    }

    setIsAddSubmitting(true);

    try {
      const deliveryTypeCombined = `${addFormData.delivery_type} (${addFormData.delivery_destination})`;
      const deliveryDateTimeUtc = localDateTimeToUtcIso(addFormData.delivery_datetime);
      const nowIso = new Date().toISOString();
      const orderSalesPayload = {
        name: addFormData.customer_name.trim(),
        whatsapp: `+62${addFormData.whatsapp.trim()}`,
        delivery_datetime: deliveryDateTimeUtc,
        delivery_address: addFormData.delivery_address.trim(),
        delivery_type: deliveryTypeCombined,
        remark: addFormData.remark.trim() || null,
        delivery_cost: addFormData.delivery_cost.trim() ? addSummaryTotals.deliveryCost : null,
        total_items: addSummaryTotals.totalItems,
        total_price: addSummaryTotals.totalPrice,
        final_price: addSummaryTotals.finalPrice,
        is_paid: addFormData.is_paid,
        is_delivered: addFormData.is_delivered,
        total_cost: addSummaryTotals.totalCost,
        net_income: addComputedNetIncome,
        user_update: currentUserDisplayName,
        ...(modalMode === 'edit'
          ? {
              updated_date: nowIso,
            }
          : {
              created_date: nowIso,
            }),
      };

      const detailPayload = addFormItems.map((item) => {
        const computed = getAddItemComputedValues(item);

        return {
          order_pricing_id: Number.parseInt(item.order_pricing_id, 10),
          quantity: item.quantity,
          is_free: item.is_free,
          total_price: computed.totalPrice,
          total_cost: computed.totalCost,
          net_income: computed.netIncome,
        };
      });

      if (modalMode === 'edit') {
        if (!editingOrderId) {
          throw new Error('No selected order to edit.');
        }

        const { error: updateOrderError } = await supabase
          .from('order_sales')
          .update(orderSalesPayload)
          .eq('id', editingOrderId);

        if (updateOrderError) {
          throw updateOrderError;
        }

        const { error: deleteDetailError } = await supabase
          .from('order_sales_detail')
          .delete()
          .eq('order_sales_id', editingOrderId);

        if (deleteDetailError) {
          throw deleteDetailError;
        }

        const editDetailPayload = detailPayload.map((item) => ({
          ...item,
          order_sales_id: editingOrderId,
        }));

        const { error: recreateDetailError } = await supabase
          .from('order_sales_detail')
          .insert(editDetailPayload);

        if (recreateDetailError) {
          throw recreateDetailError;
        }

        await queryClient.invalidateQueries({ queryKey: ['order-sales'] });
        await queryClient.invalidateQueries({ queryKey: ['order-sales-detail'] });
        toast.success('Order sales berhasil diperbarui.');
        handleCloseAddModal();
        return;
      }

      const { data: createdRows, error: createOrderError } = await supabase
        .from('order_sales')
        .insert([orderSalesPayload])
        .select('id')
        .limit(1);

      if (createOrderError) {
        throw createOrderError;
      }

      const createdOrderId = createdRows?.[0]?.id;
      if (!createdOrderId) {
        throw new Error('Failed to create order_sales record.');
      }

      const addDetailPayload = detailPayload.map((item) => ({
        ...item,
        order_sales_id: createdOrderId,
      }));

      const { error: createDetailError } = await supabase
        .from('order_sales_detail')
        .insert(addDetailPayload);

      if (createDetailError) {
        await supabase
          .from('order_sales')
          .delete()
          .eq('id', createdOrderId);
        throw createDetailError;
      }

      await queryClient.invalidateQueries({ queryKey: ['order-sales'] });
      toast.success('Order sales berhasil ditambahkan.');
      handleCloseAddModal();
    } catch (error) {
      console.error('Error creating order sales:', error);
      if (modalMode === 'add') {
        toast.error(`Gagal menambahkan order sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } else {
        toast.error(`Gagal menyimpan perubahan order sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsAddSubmitting(false);
    }
  };

  const detailEntries = useMemo(
    () => {
      const entries = Object.entries(selectedOrderDetail ?? {}).filter(([key]) => !ORDER_DETAIL_EXCLUDED_FIELDS.has(key));
      const totalCostEntry = entries.find(([key]) => key === 'total_cost');
      const netIncomeEntry = entries.find(([key]) => key === 'net_income');
      const regularEntries = entries.filter(([key]) => key !== 'total_cost' && key !== 'net_income');

      if (totalCostEntry) {
        regularEntries.push(totalCostEntry);
      }

      if (netIncomeEntry) {
        regularEntries.push(netIncomeEntry);
      }

      return regularEntries;
    },
    [selectedOrderDetail],
  );

  const getBooleanValue = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') {
      return value;
    }

    return null;
  };

  const paidStatus = getBooleanValue(selectedOrderDetail?.is_paid);
  const deliveredStatus = getBooleanValue(selectedOrderDetail?.is_delivered);

  const formatFieldLabel = (key: string) =>
    key
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const getNumericValue = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    return null;
  };

  const renderNetIncomeIndicator = (netIncome: number, sensorClass = detailSensorClass) => (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${
        netIncome > 0 ? 'text-emerald-700' : netIncome < 0 ? 'text-rose-700' : 'text-slate-700'
      }`}
      title={netIncome > 0 ? 'Profit' : netIncome < 0 ? 'Loss' : 'Break Even'}
      aria-label={netIncome > 0 ? 'Profit' : netIncome < 0 ? 'Loss' : 'Break Even'}
    >
      {netIncome > 0 ? <TrendingUp className="h-4 w-4" /> : netIncome < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
      <span className={sensorClass}>{formatCurrency(netIncome)}</span>
    </span>
  );

  const renderDetailFieldValue = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (typeof value === 'boolean') {
      return value ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />;
    }

    const numericValue = getNumericValue(value);

    if (key === 'total_cost' && numericValue !== null) {
      return <span className={detailSensorClass}>{formatCurrency(numericValue)}</span>;
    }

    if ((key === 'is_paid' || key === 'is_delivered') && (value === true || value === false || value === null)) {
      return <StatusIcon value={value as boolean | null} label={formatFieldLabel(key)} />;
    }

    if (/(price|cost|income)/.test(key) && numericValue !== null) {
      return formatCurrency(numericValue);
    }

    if (key === 'delivery_datetime' && typeof value === 'string') {
      const deliveryDateTime = formatDeliveryDateTime(value);
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <CalendarDays className="h-4 w-4 text-cyan-700" />
            <span>{deliveryDateTime.date}</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap text-slate-600">
            <Clock3 className="h-4 w-4 text-cyan-700" />
            <span>{deliveryDateTime.time}</span>
          </div>
        </div>
      );
    }

    if (typeof value === 'string' && key.endsWith('_date')) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-GB', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }).format(date);
      }
    }

    return String(value);
  };

  return (
    <div className="page-enter space-y-5">
      <div className="page-header">
        <nav className="text-xs text-slate-400" aria-label="Breadcrumb">
          <ol className="inline-flex list-none items-center gap-1.5 p-0">
            <li>Home</li>
            <li>/</li>
            <li>Sales</li>
            <li>/</li>
            <li className="font-semibold text-cyan-700">Order</li>
          </ol>
        </nav>
        <h1 className="page-title">Order Sales</h1>
        <p className="page-subtitle">Monitor and manage sales data from order channels efficiently.</p>
      </div>

      <div className="glass-panel overflow-hidden rounded-xl border border-slate-200">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={`Search ${animatedPlaceholderText}`}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-cyan-200 transition focus:ring-2"
            />
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="modern-primary flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-cyan-800">Ongoing</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading order sales…</div>
            ) : ongoingRecords.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-400">
                {hasKeyword ? 'No ongoing orders match your search.' : 'No ongoing orders.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {ongoingRecords.map((record) => {
                  const deliveryDateTime = formatDeliveryDateTime(record.delivery_datetime);
                  const isDeleting = deletingOrderId === record.id;
                  return (
                    <div key={record.id} className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-800">{record.name || '-'}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{record.whatsapp || '-'}</p>
                        </div>
                        <div className="flex-shrink-0">
                          <OrderStatusBadge isPaid={record.is_paid} isDelivered={record.is_delivered} />
                        </div>
                      </div>
                      <div className="flex-1 space-y-1.5 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-cyan-600" />
                          <span className="truncate">{deliveryDateTime.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock3 className="h-3.5 w-3.5 flex-shrink-0 text-cyan-600" />
                          <span>{deliveryDateTime.time}</span>
                        </div>
                        {record.delivery_type && (
                          <p className="text-xs text-slate-500">{record.delivery_type}</p>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-slate-400">{record.total_items ?? 0} item(s)</span>
                          <span className="text-sm font-semibold text-slate-800">{formatCurrency(record.total_price ?? 0)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 border-t border-slate-100 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(record.id)}
                          aria-label={`View detail for ${record.name}`}
                          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleOpenEditModal(record.id); }}
                          aria-label={`Edit ${record.name}`}
                          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-cyan-200 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReportModal(record)}
                          aria-label={`Report for ${record.name}`}
                          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-200 px-3 py-1.5 text-violet-600 transition-colors hover:bg-violet-50"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleDeleteOrder(record); }}
                          disabled={isDeleting}
                          aria-label={`Delete ${record.name}`}
                          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-rose-200 px-3 py-1.5 text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && ongoingRecords.length > 0 && (
              <Pagination
                currentPage={ongoingCurrentPage}
                totalItems={ongoingTotalItems}
                pageSize={TABLE_PAGE_SIZE}
                onPageChange={setOngoingCurrentPage}
              />
            )}
          </div>

          <details
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            onToggle={(event) => setIsPastOrdersOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer list-none border-b border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-cyan-800">
              All Past Orders
            </summary>

            {pastOrdersLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading order sales…</div>
            ) : pastOrderRecords.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-400">
                {hasKeyword ? 'No past orders match your search.' : 'No past orders yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {pastOrderRecords.map((record) => {
                  const deliveryDateTime = formatDeliveryDateTime(record.delivery_datetime);
                  const isDeleting = deletingOrderId === record.id;
                  return (
                    <div key={record.id} className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-800">{record.name || '-'}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{record.whatsapp || '-'}</p>
                        </div>
                        <div className="flex-shrink-0">
                          <OrderStatusBadge isPaid={record.is_paid} isDelivered={record.is_delivered} />
                        </div>
                      </div>
                      <div className="flex-1 space-y-1.5 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-cyan-600" />
                          <span className="truncate">{deliveryDateTime.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock3 className="h-3.5 w-3.5 flex-shrink-0 text-cyan-600" />
                          <span>{deliveryDateTime.time}</span>
                        </div>
                        {record.delivery_type && (
                          <p className="text-xs text-slate-500">{record.delivery_type}</p>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-slate-400">{record.total_items ?? 0} item(s)</span>
                          <span className="text-sm font-semibold text-slate-800">{formatCurrency(record.total_price ?? 0)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 border-t border-slate-100 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(record.id)}
                          aria-label={`View detail for ${record.name}`}
                          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleOpenEditModal(record.id); }}
                          aria-label={`Edit ${record.name}`}
                          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-cyan-200 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReportModal(record)}
                          aria-label={`Report for ${record.name}`}
                          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-200 px-3 py-1.5 text-violet-600 transition-colors hover:bg-violet-50"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleDeleteOrder(record); }}
                          disabled={isDeleting}
                          aria-label={`Delete ${record.name}`}
                          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-rose-200 px-3 py-1.5 text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!pastOrdersLoading && isPastOrdersOpen && pastOrderRecords.length > 0 && (
              <Pagination
                currentPage={pastOrdersCurrentPage}
                totalItems={pastOrdersTotalItems}
                pageSize={TABLE_PAGE_SIZE}
                onPageChange={setPastOrdersCurrentPage}
              />
            )}
          </details>

          {!loading && !pastOrdersLoading && totalMatchingItems === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400">
              {hasKeyword ? 'No orders match your search.' : 'No order sales data yet.'}
            </div>
          )}
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex max-h-[94vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{modalMode === 'edit' ? 'Edit Order Sales' : 'Add Order Sales'}</h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  {modalMode === 'edit'
                    ? 'Update order sales data with customer, delivery, pricing, and item details.'
                    : 'Create order sales data with customer, delivery, pricing, and item details.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSensorOn((prev) => !prev)}
                  title={isAddSensorOn ? 'Show financials' : 'Hide financials'}
                  aria-label={isAddSensorOn ? 'Show financials' : 'Hide financials'}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isAddSensorOn
                      ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                  }`}
                >
                  {isAddSensorOn ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {isAddSensorOn ? 'Sensor On' : 'Sensor Off'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  disabled={isAddSubmitting}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isEditLoading ? (
              <div className="flex flex-1 items-center justify-center py-16 text-sm text-slate-400">Loading order data…</div>
            ) : (
              <>
                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className="space-y-5">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">Customer</h3>
                        {modalMode !== 'edit' && (
                          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                            <button
                              type="button"
                              onClick={() => handleCustomerModeChange('existing')}
                              className={`rounded-md cursor-pointer px-3 py-1.5 text-xs font-semibold transition ${
                                customerMode === 'existing' ? 'bg-cyan-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              Existing
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCustomerModeChange('new')}
                              className={`rounded-md cursor-pointer px-3 py-1.5 text-xs font-semibold transition ${
                                customerMode === 'new' ? 'bg-cyan-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              New
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                    {modalMode === 'edit' ? (
                      <input
                        type="text"
                        value={addFormData.customer_name}
                        readOnly
                        className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700"
                      />
                    ) : customerMode === 'existing' ? (
                      <Select<SimpleSelectOption, false>
                        options={customerOptions}
                        value={selectedCustomerOption}
                        onChange={handleExistingCustomerChange}
                        onInputChange={handleCustomerSearchInputChange}
                        isSearchable
                        isClearable
                        placeholder="Select loyal customer"
                        formatOptionLabel={(option) => <span>{renderHighlightedLabel(option.label, customerSearchKeyword)}</span>}
                        noOptionsMessage={() => 'Loyal customer not found'}
                        classNames={getReactSelectClassNames(false, false)}
                      />
                    ) : (
                      <input
                        type="text"
                        value={addFormData.customer_name}
                        onChange={(event) => handleAddFormFieldChange('customer_name', event.target.value)}
                        placeholder="Enter customer name"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Whatsapp</label>
                    <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
                      <span className="inline-flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">+62</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={addFormData.whatsapp}
                        onChange={(event) => handleWhatsappChange(event.target.value)}
                        disabled={customerMode === 'existing' && !selectedCustomer}
                        placeholder="8xxxxxxxxxx"
                        className="w-full border-0 bg-white px-3 py-2 text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </div>
                    {whatsappPrefixWarning && (
                      <p className="mt-1 text-xs text-amber-700">Prefix +62 tidak perlu diketik karena sudah otomatis.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Delivery</h3>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Delivery Datetime</label>
                    <DatePicker
                      selected={addFormData.delivery_datetime ? new Date(addFormData.delivery_datetime) : null}
                      onChange={handleDeliveryDateTimeChange}
                      showTimeSelect
                      timeIntervals={15}
                      dateFormat="EEEE, dd MMM yyyy HH:mm"
                      placeholderText="Select delivery date and time"
                      isClearable
                      wrapperClassName="w-full"
                      className="!w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      popperClassName="z-[90]"
                      onKeyDown={(event) => event.preventDefault()}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Delivery Type</label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Select<SimpleSelectOption, false>
                        options={deliveryTypeOptions}
                        value={selectedDeliveryTypeOption}
                        onChange={handleDeliveryTypeSelectChange}
                        onInputChange={handleDeliveryTypeSearchInputChange}
                        isSearchable
                        isClearable={false}
                        placeholder="Select delivery type"
                        formatOptionLabel={(option) => <span>{renderHighlightedLabel(option.label, deliveryTypeSearchKeyword)}</span>}
                        noOptionsMessage={() => 'Delivery type not found'}
                        classNames={getReactSelectClassNames(false, false)}
                      />
                      <Select<SimpleSelectOption, false>
                        options={deliveryDestinationOptions}
                        value={selectedDeliveryDestinationOption}
                        onChange={handleDeliveryDestinationSelectChange}
                        onInputChange={handleDeliveryDestinationSearchInputChange}
                        isSearchable
                        isClearable={false}
                        placeholder="Select destination"
                        formatOptionLabel={(option) => <span>{renderHighlightedLabel(option.label, deliveryDestinationSearchKeyword)}</span>}
                        noOptionsMessage={() => 'Destination not found'}
                        classNames={getReactSelectClassNames(false, false)}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Delivery Address</label>
                    <textarea
                      rows={3}
                      value={addFormData.delivery_address}
                      onChange={(event) => handleAddFormFieldChange('delivery_address', event.target.value)}
                      disabled={customerMode === 'existing' && !selectedCustomer}
                      placeholder="Enter delivery address"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                    <textarea
                      rows={3}
                      value={addFormData.remark}
                      onChange={(event) => handleAddFormFieldChange('remark', event.target.value)}
                      placeholder="Additional order notes"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Price</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Delivery Cost</label>
                    <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
                      <span className="inline-flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={addFormData.delivery_cost}
                        onChange={(event) => handleAddFormFieldChange('delivery_cost', formatPriceInput(event.target.value))}
                        placeholder="0"
                        className="w-full border-0 bg-white px-3 py-2 text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Total Items</label>
                    <input
                      type="text"
                      value={addSummaryTotals.totalItems.toLocaleString('id-ID')}
                      disabled
                      className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Total Price</label>
                    <input
                      type="text"
                      value={formatCurrency(addSummaryTotals.totalPrice)}
                      disabled
                      className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Final Price</label>
                    <input
                      type="text"
                      value={formatCurrency(addSummaryTotals.finalPrice)}
                      disabled
                      className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Misc</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Payment Status</label>
                    <button
                      type="button"
                      onClick={() => handleAddFormFieldChange('is_paid', !addFormData.is_paid)}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                        addFormData.is_paid
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      {addFormData.is_paid ? <BanknoteArrowUp className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                      {addFormData.is_paid ? 'Paid' : 'Pending'}
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Delivery Status</label>
                    <button
                      type="button"
                      onClick={() => handleAddFormFieldChange('is_delivered', !addFormData.is_delivered)}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                        addFormData.is_delivered
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      {addFormData.is_delivered ? <PackageCheck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                      {addFormData.is_delivered ? 'Delivered' : 'Pending'}
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Total Cost</label>
                    <input
                      type="text"
                      value={formatCurrency(addSummaryTotals.totalCost)}
                      disabled
                      className={`w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700 ${addSensorClass}`}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Net Income</label>
                    <input
                      type="text"
                      value={formatCurrency(addComputedNetIncome)}
                      disabled
                      className={`w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700 ${addSensorClass}`}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Items</h3>
                    <p className="mt-1 text-xs text-slate-400">Product can only be selected after quantity is filled. Product options follow min order against quantity.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100"
                  >
                    <Plus className="h-4 w-4" />
                    Add Row
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {addFormItems.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-sm text-slate-400">No items added yet. Click Add Row to start.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="modern-table w-full min-w-[1180px]">
                        <thead className="border-b border-slate-100 bg-slate-50/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Quantity</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Is Free</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Selling Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Cost</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Net Income</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedAddFormItems.map((item) => {
                            const itemOptions = filteredAddProductOptionsByQuantity[item.id] ?? [];
                            const selectedOption = itemOptions.find((option) => option.value === item.order_pricing_id) ?? null;
                            const computed = getAddItemComputedValues(item);

                            return (
                              <tr key={item.id}>
                                <td className="px-4 py-3 align-top">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={item.quantity > 0 ? String(item.quantity) : ''}
                                    placeholder="0"
                                    onChange={(event) => handleAddItemChange(item.id, 'quantity', parseNumberInput(event.target.value))}
                                    className="w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                  />
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <Select<AddProductOption, false>
                                    options={itemOptions}
                                    value={selectedOption}
                                    onChange={(selected) => handleProductChange(item.id, selected)}
                                    onInputChange={(inputValue, meta) => handleProductSearchInputChange(item.id, inputValue, meta)}
                                    isSearchable
                                    isClearable
                                    isDisabled={item.quantity <= 0}
                                    placeholder={item.quantity > 0 ? 'Select product' : 'Isi quantity terlebih dahulu'}
                                    formatOptionLabel={(option) => <span>{renderHighlightedLabel(option.label, productSearchKeyword[item.id] ?? '')}</span>}
                                    noOptionsMessage={() => 'No product available for this quantity'}
                                    classNames={getReactSelectClassNames(false, item.quantity <= 0)}
                                    menuPortalTarget={selectPortalTarget}
                                    menuPosition="fixed"
                                    styles={{ menuPortal: (base) => ({ ...base, zIndex: 80 }) }}
                                  />
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <button
                                    type="button"
                                    onClick={() => handleAddItemChange(item.id, 'is_free', !item.is_free)}
                                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                      item.is_free
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    {item.is_free ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                    {item.is_free ? 'Free' : 'Paid'}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-900">{formatCurrency(computed.sellingPrice)}</td>
                                <td className="px-4 py-3 text-sm text-slate-900">{formatCurrency(computed.totalPrice)}</td>
                                <td className="px-4 py-3 text-sm text-slate-900">
                                  <span className={addSensorClass}>{formatCurrency(computed.totalCost)}</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-900">{renderNetIncomeIndicator(computed.netIncome, addSensorClass)}</td>
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRow(item.id)}
                                    className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-rose-200 text-rose-700 transition-colors hover:bg-rose-50"
                                    aria-label="Remove item row"
                                    title="Remove row"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {addFormItems.length > 0 && (
                    <Pagination
                      currentPage={addItemsCurrentPage}
                      totalItems={addFormItems.length}
                      pageSize={ADD_ITEMS_PAGE_SIZE}
                      onPageChange={setAddItemsCurrentPage}
                    />
                  )}
                </div>
              </div>

                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-3 border-t border-slate-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={handleCloseAddModal}
                    disabled={isAddSubmitting}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitAddForm}
                    disabled={isAddSubmitting || isEditLoading}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-700 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {isAddSubmitting ? (modalMode === 'edit' ? 'Saving…' : 'Submitting…') : (modalMode === 'edit' ? 'Save Changes' : 'Submit')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex max-h-[94vh] w-full max-w-[1560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Order Sales Detail</h2>
                <p className="mt-0.5 text-sm text-slate-400">Detailed summary and order items for the selected transaction.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <span className="text-xs font-semibold text-slate-500">Paid</span>
                  <span className={`inline-flex rounded-full p-1 ${paidStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {paidStatus ? <BanknoteArrowUp className="h-4 w-4" /> : <BanknoteX className="h-4 w-4" />}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <span className="text-xs font-semibold text-slate-500">Delivered</span>
                  <span className={`inline-flex rounded-full p-1 ${deliveredStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {deliveredStatus ? <PackageCheck className="h-4 w-4" /> : <PackageX className="h-4 w-4" />}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailSensorOn((prev) => !prev)}
                  title={isDetailSensorOn ? 'Show financials' : 'Hide financials'}
                  aria-label={isDetailSensorOn ? 'Show financials' : 'Hide financials'}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isDetailSensorOn
                      ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                  }`}
                >
                  {isDetailSensorOn ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {isDetailSensorOn ? 'Sensor On' : 'Sensor Off'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Overview</h3>
                {orderDetailLoading ? (
                  <div className="flex items-center justify-center rounded-xl border border-slate-200 py-12 text-sm text-slate-400">Loading order data…</div>
                ) : detailEntries.length === 0 ? (
                  <div className="flex items-center justify-center rounded-xl border border-slate-200 py-12 text-sm text-slate-400">No overview data found.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {detailEntries.map(([key, value], index) => {
                      const isTwoCardsRemainder = detailEntries.length % 4 === 2 && index >= detailEntries.length - 2;
                      const remainderSpanClass = isTwoCardsRemainder ? 'lg:col-span-2' : '';

                      return key === 'net_income' ? (
                        <div
                          key={key}
                          className={`rounded-xl border p-4 shadow-sm ${remainderSpanClass} ${
                            getNumericValue(value) && getNumericValue(value)! > 0
                              ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50'
                              : getNumericValue(value) && getNumericValue(value)! < 0
                                ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50'
                                : 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Income</p>
                            {typeof value === 'number' && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  value > 0 ? 'bg-emerald-100 text-emerald-800' : value < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {value > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : value < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                                {value > 0 ? 'Profit' : value < 0 ? 'Loss' : 'Break Even'}
                              </span>
                            )}
                          </div>
                          <p
                            className={`mt-2 text-lg font-bold ${
                              typeof value === 'number' && value > 0
                                ? 'text-emerald-700'
                                : typeof value === 'number' && value < 0
                                  ? 'text-rose-700'
                                  : 'text-slate-700'
                            }`}
                          >
                            {typeof value === 'number' ? <span className={detailSensorClass}>{formatCurrency(value)}</span> : '-'}
                          </p>
                        </div>
                      ) : (
                        <div key={key} className={`rounded-xl border border-slate-200 bg-slate-50/50 p-4 ${remainderSpanClass}`}>
                          <p className="text-xs font-medium text-slate-400">{formatFieldLabel(key)}</p>
                          <p className="mt-1.5 text-sm font-semibold text-slate-800">{renderDetailFieldValue(key, value)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">Items</h3>
                  {!detailLoading && detailRecords.length > 0 && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">{detailTotalItems}</span>
                  )}
                </div>

                {detailLoading ? (
                  <div className="flex items-center justify-center rounded-xl border border-slate-200 py-12 text-sm text-slate-400">Loading items…</div>
                ) : detailRecords.length === 0 ? (
                  <div className="flex items-center justify-center rounded-xl border border-slate-200 py-12 text-sm text-slate-400">No items found.</div>
                ) : (
                  <div className="space-y-2">
                    {detailRecords.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800">{item.item_name || '-'}</p>
                            {item.is_free && (
                              <span className="mt-1.5 inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Free</span>
                            )}
                          </div>
                          <span className="flex-shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-semibold text-slate-600">×{item.quantity}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-xs text-slate-400">Unit Price</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-700">{formatCurrency(item.selling_price ?? 0)}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-xs text-slate-400">Total Price</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-700">{formatCurrency(item.total_price ?? 0)}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-xs text-slate-400">Total Cost</p>
                            <p className={`mt-0.5 text-sm font-semibold text-slate-700 ${detailSensorClass}`}>{formatCurrency(item.total_cost ?? 0)}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-xs text-slate-400">Net Income</p>
                            <div className="mt-0.5">{renderNetIncomeIndicator(item.net_income ?? 0)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!detailLoading && detailRecords.length > 0 && (
                  <Pagination
                    currentPage={detailCurrentPage}
                    totalItems={detailTotalItems}
                    pageSize={TABLE_PAGE_SIZE}
                    onPageChange={setDetailCurrentPage}
                  />
                )}
              </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 justify-end border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={handleCloseDetail}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {reportRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex max-h-[94vh] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Generate Report</h2>
                <p className="mt-0.5 text-sm text-slate-400">Preview order receipt and cost report.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseReportModal}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isReportDetailLoading || isReportDetailFetching ? (
                <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading report data…</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => setReportTabIndex('receipt')}
                      className={`px-4 py-3 text-sm font-medium transition-colors ${
                        reportTabIndex === 'receipt'
                          ? 'border-b-2 border-cyan-500 text-cyan-700'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Order Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportTabIndex('cost')}
                      className={`px-4 py-3 text-sm font-medium transition-colors ${
                        reportTabIndex === 'cost'
                          ? 'border-b-2 border-cyan-500 text-cyan-700'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Order Cost
                    </button>
                  </div>

                  {reportTabIndex === 'receipt' && (
                    <div className="space-y-4">
                      <div id="order-receipt-content" className="rounded-xl border border-slate-300 bg-white p-6 text-slate-900">
                        <div className="border-b border-dashed border-slate-300 pb-4">
                          <h3 className="text-center text-lg font-bold">Struk Pesanan</h3>
                          <p className="mt-2 text-center text-sm text-slate-600">Aneka Kue 339</p>
                        </div>

                        <div className="mt-6 space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nama</p>
                              <p className="mt-1 text-sm font-medium">{reportRecord.name || '-'}</p>
                            </div>
                            <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">WhatsApp</p>
                              <p className="mt-1 text-sm font-medium">{reportRecord.whatsapp || '-'}</p>
                            </div>
                            <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Jenis Pengiriman</p>
                              <p className="mt-1 text-sm font-medium">{reportRecord.delivery_type || '-'}</p>
                            </div>
                            <div className="col-span-3">
                              <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2 rounded-lg border border-cyan-100 bg-cyan-50/60 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Alamat Pengiriman</p>
                                  <p className="mt-1 text-sm font-medium">{reportRecord.delivery_address || '-'}</p>
                                </div>
                                <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 p-3 text-sm font-medium text-slate-700">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tanggal Pengiriman</p>
                                  <div className="mt-1 flex items-center gap-2 leading-normal">
                                    <CalendarDays className="h-4 w-4 text-cyan-700" />
                                    <span className="whitespace-nowrap">{reportDateTimeParts.date}</span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 leading-normal">
                                    <Clock3 className="h-4 w-4 text-cyan-700" />
                                    <span className="whitespace-nowrap">{reportDateTimeParts.time}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="col-span-3">
                              <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Catatan</p>
                                <p className="mt-1 text-sm font-medium">{reportRecord.remark || '-'}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6">
                          <h4 className="text-sm font-semibold text-slate-900">Item</h4>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                              <thead>
                                <tr className="border-b border-slate-300">
                                  <th className="px-2 py-2 text-left font-semibold">Item</th>
                                  <th className="px-2 py-2 text-center font-semibold">Qty</th>
                                  <th className="px-2 py-2 text-right font-semibold">Harga</th>
                                  <th className="px-2 py-2 text-right font-semibold">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(reportDetailRecords ?? []).map((item) => (
                                  <tr key={item.id} className="border-b border-slate-100">
                                    <td className="px-2 py-2">{item.item_name}</td>
                                    <td className="px-2 py-2 text-center">{item.quantity}</td>
                                    <td className="px-2 py-2 text-right">{item.is_free ? 'Gratis' : formatCurrency(item.selling_price)}</td>
                                    <td className="px-2 py-2 text-right">{item.is_free ? 'Gratis' : formatCurrency(item.total_price)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="mt-6 border-t border-dashed border-slate-300 pt-4">
                          <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 text-base">
                            <p className="m-0 whitespace-nowrap">Total Item:</p>
                            <p className="m-0 whitespace-nowrap text-right font-medium">{reportRecord.total_items ?? 0}</p>

                            <p className="m-0 whitespace-nowrap">Total Harga:</p>
                            <p className="m-0 whitespace-nowrap text-right font-medium">{formatCurrency(reportRecord.total_price ?? 0)}</p>

                            {reportDeliveryCost !== null && (
                              <>
                                <p className="m-0 whitespace-nowrap">Biaya Kirim:</p>
                                <p className="m-0 whitespace-nowrap text-right font-medium">{formatCurrency(reportDeliveryCost)}</p>
                              </>
                            )}
                          </div>
                          <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-x-4 border-t border-slate-200 pt-3 text-lg font-bold">
                            <p className="m-0 whitespace-nowrap">Harga Akhir:</p>
                            <p className="m-0 whitespace-nowrap text-right">{formatCurrency(reportFinalPrice)}</p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => { void handleDownloadReceipt(); }}
                        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-700"
                      >
                        <Download className="h-4 w-4" />
                        Download JPG
                      </button>
                    </div>
                  )}

                  {reportTabIndex === 'cost' && (
                    <div className="space-y-4">
                      <div id="order-cost-content" className="rounded-xl border border-slate-300 bg-white p-6 text-slate-900">
                        <div className="border-b border-dashed border-slate-300 pb-4">
                          <h3 className="text-center text-lg font-bold">Laporan Biaya</h3>
                          <p className="mt-2 text-center text-sm text-slate-600">Aneka Kue 339</p>
                          <div className="mt-2 flex flex-col items-center gap-1 text-sm font-medium text-slate-700">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-cyan-700" />
                              <span>{reportDateTimeParts.date}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6">
                          <h4 className="mb-3 text-sm font-semibold text-slate-900">Biaya Item</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                              <thead>
                                <tr className="border-b border-slate-300">
                                  <th className="px-2 py-2 text-left font-semibold">Item</th>
                                  <th className="px-2 py-2 text-center font-semibold">Qty</th>
                                  <th className="px-2 py-2 text-right font-semibold">Harga Pokok</th>
                                  <th className="px-2 py-2 text-right font-semibold">Total Biaya</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(reportDetailRecords ?? []).map((item) => (
                                  <tr key={item.id} className="border-b border-slate-100">
                                    <td className="px-2 py-2">{item.item_name}</td>
                                    <td className="px-2 py-2 text-center">{item.quantity}</td>
                                    <td className="px-2 py-2 text-right">{formatCurrency(item.base_price)}</td>
                                    <td className="px-2 py-2 text-right">{formatCurrency(item.total_cost)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="mt-6 border-t border-dashed border-slate-300 pt-4">
                          <div className="flex items-center justify-between text-lg font-bold">
                            <span>Total Biaya:</span>
                            <span>
                              {formatCurrency(
                                (reportDetailRecords ?? []).reduce((sum, item) => sum + item.total_cost, 0)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => { void handleDownloadCostReport(); }}
                        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-700"
                      >
                        <Download className="h-4 w-4" />
                        Download JPG
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 justify-end border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={handleCloseReportModal}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { confirmDialog.onCancel(); closeConfirm(); }}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold text-slate-800">Confirm</h3>
            <p className="mb-6 text-sm text-slate-600">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { confirmDialog.onCancel(); closeConfirm(); }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { confirmDialog.onConfirm(); closeConfirm(); }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesOrder;
