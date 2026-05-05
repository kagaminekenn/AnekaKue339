import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { CircleCheck, CircleX, Download, Eye, EyeOff, FileText, MapPin, Minus, Pencil, Plus, Save, TrendingDown, TrendingUp, X, XCircle, Trash2, Calendar } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select, { type InputActionMeta, type SingleValue } from 'react-select';
import Pagination from '../components/Pagination';
import { SELLING_LOCATIONS } from '../constants/main';
import { ADD_ITEMS_PAGE_SIZE, OFFICE_SALES_API_URL, OFFICE_SALES_DETAIL_API_URL, OFFICE_SALES_DETAIL_WRITE_API_URL } from '../constants/main';
import { PAGE_SIZE, downloadElementAsJpg, formatCurrency, getStatusBadgeClassName, parseNumberInput, toNullIfZero } from '../utils/helper';
import { getReactSelectClassNames, renderHighlightedLabel } from '../utils/officePricing';
import { supabase } from '../utils/supabase';
import type {
  AddFormData,
  AddFormItem,
  AddItemBasePriceRow,
  AddOfficePricingOption,
  AddOfficePricingRow,
  DetailSortKey,
  OfficeSalesDetailQueryResult,
  OfficeSalesDetailRecord,
  OfficeSalesQueryResult,
  OfficeSalesRecord,
  SortDirection,
  SortKey,
} from '../types/officeSales';
import type { LocationSelectOption } from '../types/officePricing';

const OFFICE_SALES_CARD_PAGE_SIZE = 6;

const CalendarTriggerButton = forwardRef<HTMLButtonElement, { onClick?: () => void }>(({ onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className="ml-1.5 inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
    aria-label="Open date picker"
  >
    <Calendar className="h-4 w-4" />
  </button>
));

CalendarTriggerButton.displayName = 'CalendarTriggerButton';

const SalesOffice = () => {
  const defaultLocationFilter = SELLING_LOCATIONS[0] ?? '';
  const defaultSalesDate = new Date().toISOString().split('T')[0] ?? '';

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>(defaultLocationFilter);
  const [sortKey, setSortKey] = useState<SortKey>('sales_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedRecord, setSelectedRecord] = useState<OfficeSalesRecord | null>(null);
  const [reportRecord, setReportRecord] = useState<OfficeSalesRecord | null>(null);
  const [detailCurrentPage, setDetailCurrentPage] = useState(1);
  const [detailSortKey, setDetailSortKey] = useState<DetailSortKey>('item_name');
  const [detailSortDirection, setDetailSortDirection] = useState<SortDirection>('asc');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailSensorOn, setIsDetailSensorOn] = useState(true);
  const [isAddSensorOn, setIsAddSensorOn] = useState(true);
  const [isEditSensorOn, setIsEditSensorOn] = useState(true);
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OfficeSalesRecord | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {}, onCancel: () => {} });
  const [editFormData, setEditFormData] = useState<AddFormData>({
    sales_date: defaultSalesDate,
    selling_location: defaultLocationFilter,
  });
  const [editFormItems, setEditFormItems] = useState<AddFormItem[]>([]);
  const [editItemsCurrentPage, setEditItemsCurrentPage] = useState(1);
  const [editLocationSearchKeyword, setEditLocationSearchKeyword] = useState('');
  const [editProductSearchKeyword, setEditProductSearchKeyword] = useState<Record<string, string>>({});
  const [editOriginalDetailRecords, setEditOriginalDetailRecords] = useState<OfficeSalesDetailRecord[]>([]);
  const [addFormData, setAddFormData] = useState<AddFormData>({
    sales_date: defaultSalesDate,
    selling_location: defaultLocationFilter,
  });
  const [addFormItems, setAddFormItems] = useState<AddFormItem[]>([]);
  const [addItemsCurrentPage, setAddItemsCurrentPage] = useState(1);
  const [locationSearchKeyword, setLocationSearchKeyword] = useState('');
  const [productSearchKeyword, setProductSearchKeyword] = useState<Record<string, string>>({});
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState('Admin 339');
  const addSalesDateRef = useRef<HTMLInputElement | null>(null);
  const editSalesDateRef = useRef<HTMLInputElement | null>(null);

  const [isGlobalReportModalOpen, setIsGlobalReportModalOpen] = useState(false);
  const [globalReportDate, setGlobalReportDate] = useState(defaultSalesDate);

  const queryClient = useQueryClient();

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) {
      return;
    }

    input.focus();

    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === 'function') {
      pickerInput.showPicker();
      return;
    }

    input.click();
  };

  const formatSalesDate = (dateString: string | null | undefined) => {
    if (!dateString) {
      return '-';
    }

    const date = new Date(`${dateString}T00:00:00`);
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const parseDateInputValue = (dateString: string | null | undefined) => {
    if (!dateString) {
      return null;
    }

    const date = new Date(`${dateString}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const toDateInputValue = (date: Date | null) => {
    if (!date) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
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

  const { data: officeSalesData, isLoading, isFetching } = useQuery<OfficeSalesQueryResult>({
    queryKey: ['office-sales', currentPage, selectedLocationFilter, sortKey, sortDirection],
    queryFn: async () => {
      const offset = (currentPage - 1) * OFFICE_SALES_CARD_PAGE_SIZE;
      const params = new URLSearchParams({
        select: '*',
        limit: String(OFFICE_SALES_CARD_PAGE_SIZE),
        offset: String(offset),
        order: `${sortKey}.${sortDirection}`,
      });

      if (selectedLocationFilter) {
        params.set('selling_location', `eq.${selectedLocationFilter}`);
      }

      const response = await fetch(`${OFFICE_SALES_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          Prefer: 'count=exact',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch office sales: ${response.status} ${response.statusText}`);
      }

      const records = (await response.json()) as OfficeSalesRecord[];
      const contentRange = response.headers.get('content-range');
      const totalItems = contentRange ? Number.parseInt(contentRange.split('/')[1] ?? '0', 10) : records.length;

      return {
        records,
        totalItems,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: officeSalesDetailRecords,
    isLoading: isOfficeSalesDetailLoading,
    isFetching: isOfficeSalesDetailFetching,
  } = useQuery<OfficeSalesDetailQueryResult>({
    queryKey: ['office-sales-detail', selectedRecord?.id, detailCurrentPage, detailSortKey, detailSortDirection],
    queryFn: async () => {
      const offset = (detailCurrentPage - 1) * PAGE_SIZE;
      const params = new URLSearchParams({
        select: '*',
        office_sales_id: `eq.${selectedRecord?.id}`,
        limit: String(PAGE_SIZE),
        offset: String(offset),
        order: `${detailSortKey}.${detailSortDirection}`,
      });

      const response = await fetch(`${OFFICE_SALES_DETAIL_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          Prefer: 'count=exact',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch office sales detail: ${response.status} ${response.statusText}`);
      }

      const records = (await response.json()) as OfficeSalesDetailRecord[];
      const contentRange = response.headers.get('content-range');
      const totalItems = contentRange ? Number.parseInt(contentRange.split('/')[1] ?? '0', 10) : records.length;

      return {
        records,
        totalItems,
      };
    },
    enabled: selectedRecord !== null,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: reportDetailRecords,
    isLoading: isReportDetailLoading,
    isFetching: isReportDetailFetching,
  } = useQuery<OfficeSalesDetailRecord[]>({
    queryKey: ['office-sales-report-detail', reportRecord?.id],
    queryFn: async () => {
      if (!reportRecord) {
        return [];
      }

      const params = new URLSearchParams({
        select: '*',
        office_sales_id: `eq.${reportRecord.id}`,
        order: 'item_name.asc',
      });

      const response = await fetch(`${OFFICE_SALES_DETAIL_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch report detail: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as OfficeSalesDetailRecord[];
    },
    enabled: reportRecord !== null,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: globalReportSalesRecords,
    isLoading: isGlobalReportSalesLoading,
    isFetching: isGlobalReportSalesFetching,
  } = useQuery<OfficeSalesRecord[]>({
    queryKey: ['global-report-sales', globalReportDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        select: '*',
        sales_date: `eq.${globalReportDate}`,
        order: 'selling_location.asc',
      });

      const response = await fetch(`${OFFICE_SALES_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch global report sales: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as OfficeSalesRecord[];
    },
    enabled: isGlobalReportModalOpen && !!globalReportDate,
    staleTime: 1000 * 60 * 5,
  });

  const globalReportSalesIds = useMemo(
    () => (globalReportSalesRecords ?? []).map((r) => r.id),
    [globalReportSalesRecords],
  );

  const {
    data: globalReportDetailRecords,
    isLoading: isGlobalReportDetailLoading,
    isFetching: isGlobalReportDetailFetching,
  } = useQuery<OfficeSalesDetailRecord[]>({
    queryKey: ['global-report-detail', globalReportSalesIds],
    queryFn: async () => {
      if (globalReportSalesIds.length === 0) {
        return [];
      }

      const params = new URLSearchParams({
        select: '*',
        office_sales_id: `in.(${globalReportSalesIds.join(',')})`,
        order: 'item_name.asc',
      });

      const response = await fetch(`${OFFICE_SALES_DETAIL_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch global report detail: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as OfficeSalesDetailRecord[];
    },
    enabled: isGlobalReportModalOpen && globalReportSalesIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const { data: addOfficePricingRows } = useQuery<AddOfficePricingRow[]>({
    queryKey: ['add-office-sales-pricing-map', addFormData.selling_location],
    queryFn: async () => {
      if (!addFormData.selling_location) {
        return [];
      }

      const { data, error } = await supabase
        .from('office_pricing_view')
        .select('id,item_id,selling_location,selling_price,profit,start_date,end_date,is_active,item_name')
        .eq('selling_location', addFormData.selling_location)
        .eq('is_active', true)
        .order('item_name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as AddOfficePricingRow[];
    },
    enabled: isAddModalOpen,
    staleTime: 1000 * 60 * 5,
  });

  const { data: editOfficePricingRows } = useQuery<AddOfficePricingRow[]>({
    queryKey: ['edit-office-sales-pricing-map', editFormData.selling_location],
    queryFn: async () => {
      if (!editFormData.selling_location) {
        return [];
      }

      const { data, error } = await supabase
        .from('office_pricing_view')
        .select('id,item_id,selling_location,selling_price,profit,start_date,end_date,is_active,item_name')
        .eq('selling_location', editFormData.selling_location)
        .eq('is_active', true)
        .order('item_name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as AddOfficePricingRow[];
    },
    enabled: isEditModalOpen,
    staleTime: 1000 * 60 * 5,
  });

  const { data: addItemBasePriceRows } = useQuery<AddItemBasePriceRow[]>({
    queryKey: ['add-office-sales-item-base-prices'],
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
    enabled: isAddModalOpen || isEditModalOpen,
    staleTime: 1000 * 60 * 5,
  });

  const addItemBasePriceMap = useMemo(
    () => new Map((addItemBasePriceRows ?? []).map((row) => [row.id, row.base_price])),
    [addItemBasePriceRows],
  );

  const addOfficePricingOptions = useMemo<AddOfficePricingOption[]>(
    () =>
      (addOfficePricingRows ?? []).map((row) => {
        const basePrice = addItemBasePriceMap.get(row.item_id) ?? 0;

        return {
          value: String(row.id),
          label: row.item_name || `Office Pricing #${row.id}`,
          office_pricing_id: row.id,
          item_id: row.item_id,
          base_price: basePrice,
          selling_price: row.selling_price,
          profit: row.profit,
        };
    }),
    [addOfficePricingRows, addItemBasePriceMap],
  );

  const editOfficePricingOptions = useMemo<AddOfficePricingOption[]>(
    () =>
      (editOfficePricingRows ?? []).map((row) => {
        const basePrice = addItemBasePriceMap.get(row.item_id) ?? 0;

        return {
          value: String(row.id),
          label: row.item_name || `Office Pricing #${row.id}`,
          office_pricing_id: row.id,
          item_id: row.item_id,
          base_price: basePrice,
          selling_price: row.selling_price,
          profit: row.profit,
        };
      }),
    [editOfficePricingRows, addItemBasePriceMap],
  );

  const addLocationOptions = useMemo<LocationSelectOption[]>(
    () => SELLING_LOCATIONS.map((location) => ({ value: location, label: location })),
    [],
  );

  const selectedAddLocationOption = useMemo(
    () => addLocationOptions.find((option) => option.value === addFormData.selling_location) ?? null,
    [addFormData.selling_location, addLocationOptions],
  );

  const selectedEditLocationOption = useMemo(
    () => addLocationOptions.find((option) => option.value === editFormData.selling_location) ?? null,
    [editFormData.selling_location, addLocationOptions],
  );

  const addOptionMap = useMemo(
    () => new Map(addOfficePricingOptions.map((option) => [option.value, option])),
    [addOfficePricingOptions],
  );

  const editOptionMap = useMemo(
    () => new Map(editOfficePricingOptions.map((option) => [option.value, option])),
    [editOfficePricingOptions],
  );

  const getAddOption = (officePricingId: string) => addOptionMap.get(officePricingId) ?? null;
  const getEditOption = (officePricingId: string) => editOptionMap.get(officePricingId) ?? null;

  const getAddItemComputedValues = (item: AddFormItem) => {
    const option = getAddOption(item.office_pricing_id);

    if (!option) {
      return {
        totalCost: null as number | null,
        totalRevenue: 0,
        totalLoss: null as number | null,
        netIncome: 0,
      };
    }

    const totalCost = item.is_free
      ? null
      : item.is_ordered
        ? option.base_price * item.stocks
        : (option.base_price * (item.solds + item.covers)) === 0 ? null : option.base_price * (item.solds + item.covers);
    const totalRevenue = (option.selling_price * item.solds) === 0 ? null : option.selling_price * item.solds;
    const totalLoss = item.is_ordered ? option.base_price * item.leftovers : null;
    const netIncome = item.is_free ? totalRevenue : (option.profit * item.solds) - (option.base_price * item.covers) - (totalLoss ?? 0);

    return {
      totalCost,
      totalRevenue,
      totalLoss,
      netIncome,
    };
  };

  const getEditItemComputedValues = (item: AddFormItem) => {
    const option = getEditOption(item.office_pricing_id);

    if (!option) {
      return {
        totalCost: null as number | null,
        totalRevenue: 0,
        totalLoss: null as number | null,
        netIncome: 0,
      };
    }

    const totalCost = item.is_free
      ? null
      : item.is_ordered
        ? option.base_price * item.stocks
        : (option.base_price * (item.solds + item.covers)) === 0 ? null : option.base_price * (item.solds + item.covers);
    const totalRevenue = (option.selling_price * item.solds) === 0 ? null : option.selling_price * item.solds;
    const totalLoss = item.is_ordered ? option.base_price * item.leftovers : null;
    const netIncome = item.is_free ? totalRevenue : (option.profit * item.solds) - (option.base_price * item.covers) - (totalLoss ?? 0);

    return {
      totalCost,
      totalRevenue,
      totalLoss,
      netIncome,
    };
  };

  const addSummaryTotals = useMemo(() => {
    const summary = addFormItems.reduce(
      (acc, item) => {
        const computed = getAddItemComputedValues(item);

        acc.totalStocks += item.stocks;
        acc.totalSolds += item.solds;
        acc.totalLeftovers += item.leftovers;
        acc.totalCovers += item.covers;
        acc.totalCost += computed.totalCost ?? 0;
        acc.totalRevenue += computed.totalRevenue ?? 0;
        acc.totalLoss += computed.totalLoss ?? 0;
        acc.netIncome += computed.netIncome ?? 0;

        return acc;
      },
      {
        totalStocks: 0,
        totalSolds: 0,
        totalLeftovers: 0,
        totalCovers: 0,
        totalCost: 0,
        totalRevenue: 0,
        totalLoss: 0,
        netIncome: 0,
      },
    );

    return {
      ...summary,
      totalCostNullable: toNullIfZero(summary.totalCost),
      totalRevenueNullable: toNullIfZero(summary.totalRevenue),
      totalLossNullable: toNullIfZero(summary.totalLoss),
      netIncomeNullable: toNullIfZero(summary.netIncome),
    };
  }, [addFormItems]);

  const editSummaryTotals = useMemo(() => {
    const summary = editFormItems.reduce(
      (acc, item) => {
        const computed = getEditItemComputedValues(item);

        acc.totalStocks += item.stocks;
        acc.totalSolds += item.solds;
        acc.totalLeftovers += item.leftovers;
        acc.totalCovers += item.covers;
        acc.totalCost += computed.totalCost ?? 0;
        acc.totalRevenue += computed.totalRevenue ?? 0;
        acc.totalLoss += computed.totalLoss ?? 0;
        acc.netIncome += computed.netIncome ?? 0;

        return acc;
      },
      {
        totalStocks: 0,
        totalSolds: 0,
        totalLeftovers: 0,
        totalCovers: 0,
        totalCost: 0,
        totalRevenue: 0,
        totalLoss: 0,
        netIncome: 0,
      },
    );

    return {
      ...summary,
      totalCostNullable: toNullIfZero(summary.totalCost),
      totalRevenueNullable: toNullIfZero(summary.totalRevenue),
      totalLossNullable: toNullIfZero(summary.totalLoss),
      netIncomeNullable: toNullIfZero(summary.netIncome),
    };
  }, [editFormItems]);

  const records = officeSalesData?.records ?? [];
  const totalItems = officeSalesData?.totalItems ?? 0;
  const loading = isLoading || isFetching;
  const detailRecords = officeSalesDetailRecords?.records ?? [];
  const detailTotalItems = officeSalesDetailRecords?.totalItems ?? 0;
  const detailLoading = isOfficeSalesDetailLoading || isOfficeSalesDetailFetching;

  const paginatedAddFormItems = useMemo(() => {
    const start = (addItemsCurrentPage - 1) * ADD_ITEMS_PAGE_SIZE;
    const end = start + ADD_ITEMS_PAGE_SIZE;
    return addFormItems.slice(start, end);
  }, [addFormItems, addItemsCurrentPage]);

  const paginatedEditFormItems = useMemo(() => {
    const start = (editItemsCurrentPage - 1) * ADD_ITEMS_PAGE_SIZE;
    const end = start + ADD_ITEMS_PAGE_SIZE;
    return editFormItems.slice(start, end);
  }, [editFormItems, editItemsCurrentPage]);

  const handleLocationFilterChange = (location: string) => {
    setSelectedLocationFilter(location);
    setCurrentPage(1);
  };

  const getDetailSortIndicator = (key: DetailSortKey) => {
    if (detailSortKey !== key) {
      return '\u2195';
    }

    return detailSortDirection === 'asc' ? '\u2191' : '\u2193';
  };

  const handleDetailSort = (nextKey: DetailSortKey) => {
    if (detailSortKey === nextKey) {
      setDetailSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      setDetailCurrentPage(1);
      return;
    }

    setDetailSortKey(nextKey);
    setDetailSortDirection('asc');
    setDetailCurrentPage(1);
  };

  const handleOpenDetail = (record: OfficeSalesRecord) => {
    setSelectedRecord(record);
    setDetailCurrentPage(1);
    setDetailSortKey('item_name');
    setDetailSortDirection('asc');
    setIsDetailSensorOn(true);
  };

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

  const handleCloseDetail = () => {
    setSelectedRecord(null);
    setDetailCurrentPage(1);
  };

  const handleCloseReportModal = () => {
    setReportRecord(null);
  };

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
    setIsAddSensorOn(true);
  };

  const doCloseAddModal = () => {
    setIsAddModalOpen(false);
    setAddFormData({ sales_date: defaultSalesDate, selling_location: defaultLocationFilter });
    setAddFormItems([]);
    setAddItemsCurrentPage(1);
    setLocationSearchKeyword('');
    setProductSearchKeyword({});
  };

  const handleCloseAddModal = () => {
    if (isAddSubmitting) {
      return;
    }

    if (addFormItems.length > 0) {
      showConfirm('You have unsaved data. Are you sure you want to close?', doCloseAddModal);
      return;
    }

    doCloseAddModal();
  };

  const handleOpenEditModal = async (record: OfficeSalesRecord) => {
    setIsEditModalOpen(true);
    setIsEditSensorOn(true);
    setIsEditLoading(true);
    setEditFormData({
      sales_date: record.sales_date,
      selling_location: record.selling_location,
    });
    setEditItemsCurrentPage(1);
    setEditLocationSearchKeyword('');
    setEditProductSearchKeyword({});
    setEditingRecord(record);

    try {
      const params = new URLSearchParams({
        select: '*',
        office_sales_id: `eq.${record.id}`,
        order: 'item_name.asc',
      });

      const response = await fetch(`${OFFICE_SALES_DETAIL_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load office sales detail: ${response.status} ${response.statusText}`);
      }

      const detailRows = (await response.json()) as OfficeSalesDetailRecord[];

      setEditOriginalDetailRecords(detailRows);
      setEditFormItems(
        detailRows.map((item) => ({
          id: `edit-${item.id}`,
          office_pricing_id: String(item.office_pricing_id),
          stocks: item.stocks,
          solds: item.solds,
          covers: item.covers ?? 0,
          leftovers: item.leftovers ?? 0,
          is_ordered: item.is_ordered,
          is_free: item.is_free,
        })),
      );
    } catch (error) {
      alert(`Error loading sales detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsEditModalOpen(false);
      setEditingRecord(null);
      setEditFormItems([]);
      setEditOriginalDetailRecords([]);
    } finally {
      setIsEditLoading(false);
    }
  };

  const doCloseEditModal = () => {
    setIsEditModalOpen(false);
    setIsEditSensorOn(true);
    setIsEditSubmitting(false);
    setIsEditLoading(false);
    setEditingRecord(null);
    setEditFormData({ sales_date: defaultSalesDate, selling_location: defaultLocationFilter });
    setEditFormItems([]);
    setEditItemsCurrentPage(1);
    setEditLocationSearchKeyword('');
    setEditProductSearchKeyword({});
    setEditOriginalDetailRecords([]);
  };

  const handleCloseEditModal = () => {
    if (isEditSubmitting) {
      return;
    }

    if (editFormItems.length > 0) {
      showConfirm('You have unsaved data. Are you sure you want to close?', doCloseEditModal);
      return;
    }

    doCloseEditModal();
  };

  const handleAddSalesDateChange = (value: string) => {
    setAddFormData((prev) => ({
      ...prev,
      sales_date: value,
    }));
  };

  const handleAddLocationSelectChange = (selected: SingleValue<LocationSelectOption>) => {
    const nextLocation = selected?.value ?? '';
    setAddFormData((prev) => ({
      ...prev,
      selling_location: nextLocation,
    }));
    setAddFormItems([]);
    setAddItemsCurrentPage(1);
  };

  const handleAddLocationSearchInputChange = (inputValue: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') {
      setLocationSearchKeyword(inputValue);
    }

    if (meta.action === 'set-value' || meta.action === 'menu-close') {
      setLocationSearchKeyword('');
    }

    return inputValue;
  };

  const handleEditLocationSearchInputChange = (inputValue: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') {
      setEditLocationSearchKeyword(inputValue);
    }

    if (meta.action === 'set-value' || meta.action === 'menu-close') {
      setEditLocationSearchKeyword('');
    }

    return inputValue;
  };

  const handleAddProductSearchInputChange = (rowId: string, inputValue: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') {
      setProductSearchKeyword((prev) => ({
        ...prev,
        [rowId]: inputValue,
      }));
    }

    if (meta.action === 'set-value' || meta.action === 'menu-close') {
      setProductSearchKeyword((prev) => ({
        ...prev,
        [rowId]: '',
      }));
    }

    return inputValue;
  };

  const handleEditProductSearchInputChange = (rowId: string, inputValue: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') {
      setEditProductSearchKeyword((prev) => ({
        ...prev,
        [rowId]: inputValue,
      }));
    }

    if (meta.action === 'set-value' || meta.action === 'menu-close') {
      setEditProductSearchKeyword((prev) => ({
        ...prev,
        [rowId]: '',
      }));
    }

    return inputValue;
  };

  const handleAddRow = () => {
    const newItem: AddFormItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      office_pricing_id: '',
      stocks: 0,
      solds: 0,
      covers: 0,
      leftovers: 0,
      is_ordered: false,
      is_free: false,
    };

    setAddFormItems((prev) => {
      const next = [...prev, newItem];
      setAddItemsCurrentPage(Math.max(1, Math.ceil(next.length / ADD_ITEMS_PAGE_SIZE)));
      return next;
    });
  };

  const handleEditRow = () => {
    const newItem: AddFormItem = {
      id: `edit-temp-${Date.now()}-${Math.random()}`,
      office_pricing_id: '',
      stocks: 0,
      solds: 0,
      covers: 0,
      leftovers: 0,
      is_ordered: false,
      is_free: false,
    };

    setEditFormItems((prev) => {
      const next = [...prev, newItem];
      setEditItemsCurrentPage(Math.max(1, Math.ceil(next.length / ADD_ITEMS_PAGE_SIZE)));
      return next;
    });
  };

  const handleRemoveRow = (id: string) => {
    setAddFormItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      const totalPages = Math.max(1, Math.ceil(next.length / ADD_ITEMS_PAGE_SIZE));
      setAddItemsCurrentPage((current) => Math.min(current, totalPages));
      return next;
    });
  };

  const handleRemoveEditRow = (id: string) => {
    setEditFormItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      const totalPages = Math.max(1, Math.ceil(next.length / ADD_ITEMS_PAGE_SIZE));
      setEditItemsCurrentPage((current) => Math.min(current, totalPages));
      return next;
    });
  };

  const handleItemChange = (id: string, field: keyof AddFormItem, value: string | number | boolean) => {
    setAddFormItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const updated = {
          ...item,
          [field]: value,
        } as AddFormItem;

        if (field === 'stocks' || field === 'solds' || field === 'covers') {
          updated.leftovers = Math.max(updated.stocks - updated.solds - updated.covers, 0);
        }

        return updated;
      }),
    );
  };

  const handleEditItemChange = (id: string, field: keyof AddFormItem, value: string | number | boolean) => {
    setEditFormItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const updated = {
          ...item,
          [field]: value,
        } as AddFormItem;

        if (field === 'stocks' || field === 'solds' || field === 'covers') {
          updated.leftovers = Math.max(updated.stocks - updated.solds - updated.covers, 0);
        }

        return updated;
      }),
    );
  };

  const handleEditLocationSelectChange = (selected: SingleValue<LocationSelectOption>) => {
    const nextLocation = selected?.value ?? '';
    setEditFormData((prev) => ({
      ...prev,
      selling_location: nextLocation,
    }));
    setEditFormItems([]);
    setEditItemsCurrentPage(1);
  };

  const handleEditSalesDateChange = (value: string) => {
    setEditFormData((prev) => ({
      ...prev,
      sales_date: value,
    }));
  };

  const handleSubmitAddForm = async () => {
    if (isAddSubmitting) {
      return;
    }

    if (!addFormData.sales_date || !addFormData.selling_location || addFormItems.length === 0) {
      alert('Please fill in Sales Date, Selling Location, and add at least one item.');
      return;
    }

    const hasInvalidItem = addFormItems.some((item) => !item.office_pricing_id);
    if (hasInvalidItem) {
      alert('Please select Product for all item rows.');
      return;
    }

    const confirmed = await confirmAsync('Are you sure you want to submit this sales data?');
    if (!confirmed) {
      return;
    }

    setIsAddSubmitting(true);

    try {
      const rollbackOfficeSales = async (salesId: number) => {
        const rollbackResponse = await fetch(`${OFFICE_SALES_API_URL}?id=eq.${salesId}`, {
          method: 'DELETE',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        });

        if (!rollbackResponse.ok) {
          throw new Error(`Rollback failed: ${rollbackResponse.status} ${rollbackResponse.statusText}`);
        }
      };

      const salesResponse = await fetch(OFFICE_SALES_API_URL, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          sales_date: addFormData.sales_date,
          selling_location: addFormData.selling_location,
          created_date: new Date().toISOString(),
          user_update: currentUserDisplayName,
          total_stocks: addSummaryTotals.totalStocks,
          total_solds: addSummaryTotals.totalSolds,
          total_leftovers: addSummaryTotals.totalLeftovers,
          total_covers: addSummaryTotals.totalCovers,
          total_cost: addSummaryTotals.totalCost,
          total_revenue: addSummaryTotals.totalRevenueNullable,
          total_loss: addSummaryTotals.totalLossNullable,
          net_income: addSummaryTotals.netIncomeNullable,
          is_saved: false,
        }),
      });

      if (!salesResponse.ok) {
        throw new Error(`Failed to create office sales: ${salesResponse.status} ${salesResponse.statusText}`);
      }

      const createdSales = (await salesResponse.json()) as OfficeSalesRecord[];
      const salesId = createdSales[0]?.id;

      if (!salesId) {
        throw new Error('Failed to get office sales ID from API response.');
      }

      const detailPayload = addFormItems.map((item) => {
        const computed = getAddItemComputedValues(item);

        return {
          office_sales_id: salesId,
          office_pricing_id: Number.parseInt(item.office_pricing_id, 10),
          user_update: currentUserDisplayName,
          stocks: item.stocks,
          solds: item.solds,
          covers: item.covers,
          leftovers: item.leftovers,
          is_ordered: item.is_ordered,
          is_free: item.is_free,
          total_cost: computed.totalCost ?? 0,
          total_revenue: computed.totalRevenue,
          total_loss: computed.totalLoss,
          net_income: computed.netIncome ?? 0,
        };
      });

      const detailResponse = await fetch(OFFICE_SALES_DETAIL_WRITE_API_URL, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(detailPayload),
      });

      if (!detailResponse.ok) {
        try {
          await rollbackOfficeSales(salesId);
        } catch (rollbackError) {
          throw new Error(
            `Failed to create office sales items and rollback also failed: ${
              rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error'
            }`,
          );
        }

        throw new Error(`Failed to create office sales items: ${detailResponse.status} ${detailResponse.statusText}. Rollback completed.`);
      }

      await queryClient.invalidateQueries({ queryKey: ['office-sales'] });
      toast.success('Office sales added successfully.');
      doCloseAddModal();
    } catch (error) {
      console.error('Error submitting add office sales:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAddSubmitting(false);
    }
  };

  const handleSubmitEditForm = async () => {
    if (isEditSubmitting) {
      return;
    }

    if (!editingRecord) {
      alert('No selected office sales record to edit.');
      return;
    }

    if (!editFormData.sales_date || !editFormData.selling_location || editFormItems.length === 0) {
      alert('Please fill in Sales Date, Selling Location, and add at least one item.');
      return;
    }

    const hasInvalidItem = editFormItems.some((item) => !item.office_pricing_id);
    if (hasInvalidItem) {
      alert('Please select Product for all item rows.');
      return;
    }

    const confirmed = await confirmAsync('Are you sure you want to update this sales data?');
    if (!confirmed) {
      return;
    }

    setIsEditSubmitting(true);

    try {
      const updatedAt = new Date().toISOString();

      const updateSalesResponse = await fetch(`${OFFICE_SALES_API_URL}?id=eq.${editingRecord.id}`, {
        method: 'PATCH',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          sales_date: editFormData.sales_date,
          selling_location: editFormData.selling_location,
          user_update: currentUserDisplayName,
          total_stocks: editSummaryTotals.totalStocks,
          total_solds: editSummaryTotals.totalSolds,
          total_leftovers: editSummaryTotals.totalLeftovers,
          total_covers: editSummaryTotals.totalCovers,
          total_cost: editSummaryTotals.totalCost,
          total_revenue: editSummaryTotals.totalRevenueNullable,
          total_loss: editSummaryTotals.totalLossNullable,
          net_income: editSummaryTotals.netIncomeNullable,
          updated_date: updatedAt,
        }),
      });

      if (!updateSalesResponse.ok) {
        throw new Error(`Failed to update office sales: ${updateSalesResponse.status} ${updateSalesResponse.statusText}`);
      }

      const deleteDetailResponse = await fetch(`${OFFICE_SALES_DETAIL_WRITE_API_URL}?office_sales_id=eq.${editingRecord.id}`, {
        method: 'DELETE',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!deleteDetailResponse.ok) {
        throw new Error(`Failed to replace office sales detail: ${deleteDetailResponse.status} ${deleteDetailResponse.statusText}`);
      }

      const detailPayload = editFormItems.map((item) => {
        const computed = getEditItemComputedValues(item);

        return {
          office_sales_id: editingRecord.id,
          office_pricing_id: Number.parseInt(item.office_pricing_id, 10),
          user_update: currentUserDisplayName,
          updated_date: updatedAt,
          stocks: item.stocks,
          solds: item.solds,
          covers: item.covers,
          leftovers: item.leftovers,
          is_ordered: item.is_ordered,
          is_free: item.is_free,
          total_cost: computed.totalCost ?? 0,
          total_revenue: computed.totalRevenue,
          total_loss: computed.totalLoss,
          net_income: computed.netIncome ?? 0,
        };
      });

      const insertDetailResponse = await fetch(OFFICE_SALES_DETAIL_WRITE_API_URL, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(detailPayload),
      });

      if (!insertDetailResponse.ok) {
        if (editOriginalDetailRecords.length > 0) {
          const rollbackPayload = editOriginalDetailRecords.map((row) => ({
            office_sales_id: row.office_sales_id,
            office_pricing_id: row.office_pricing_id,
            user_update: row.user_update,
            updated_date: row.updated_date,
            stocks: row.stocks,
            solds: row.solds,
            covers: row.covers ?? 0,
            leftovers: row.leftovers,
            is_ordered: row.is_ordered,
            is_free: row.is_free,
            total_cost: row.total_cost,
            total_revenue: row.total_revenue,
            total_loss: row.total_loss,
            net_income: row.net_income,
          }));

          await fetch(OFFICE_SALES_DETAIL_WRITE_API_URL, {
            method: 'POST',
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(rollbackPayload),
          });
        }

        throw new Error(`Failed to update office sales items: ${insertDetailResponse.status} ${insertDetailResponse.statusText}`);
      }

      await queryClient.invalidateQueries({ queryKey: ['office-sales'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['office-sales-detail'], exact: false });
      toast.success('Office sales updated successfully.');
      doCloseEditModal();
    } catch (error) {
      console.error('Error submitting edit office sales:', error);
      toast.error(`Error updating office sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isAddModalOpen && !isEditModalOpen && !selectedRecord && !reportRecord) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (isEditModalOpen) {
        handleCloseEditModal();
        return;
      }

      if (isAddModalOpen) {
        handleCloseAddModal();
        return;
      }

      if (selectedRecord) {
        handleCloseDetail();
        return;
      }

      if (reportRecord) {
        handleCloseReportModal();
        return;
      }

      if (isGlobalReportModalOpen) {
        handleCloseGlobalReportModal();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isAddModalOpen, isEditModalOpen, selectedRecord, reportRecord, isGlobalReportModalOpen]);

  const formatReceiptDateTitle = (salesDate: string) => {
    const date = new Date(`${salesDate}T00:00:00`);

    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const formatReceiptFileName = (salesDate: string) => {
    const date = new Date(`${salesDate}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return 'office_sales_receipt_unknown.jpg';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = new Intl.DateTimeFormat('id-ID', { month: '2-digit' }).format(date);
    const year = String(date.getFullYear());

    return `${year}_${month}_${day}.jpg`;
  };

  const waitForNextPaint = async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  };

  const handleDownloadReceipt = async () => {
    if (!reportRecord) {
      return;
    }

    try {
      await waitForNextPaint();

      await downloadElementAsJpg({
        elementId: 'office-sales-receipt-content',
        fileName: formatReceiptFileName(reportRecord.sales_date),
        minWidth: 920,
        quality: 0.9,
      });
    } catch (error) {
      alert(`Gagal mengunduh struk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const detailSensorClass = isDetailSensorOn ? 'select-none blur-sm' : '';
  const addSensorClass = isAddSensorOn ? 'select-none blur-sm' : '';
  const editSensorClass = isEditSensorOn ? 'select-none blur-sm' : '';

  const handleOpenGlobalReportModal = () => {
    setIsGlobalReportModalOpen(true);
  };

  const handleCloseGlobalReportModal = () => {
    setIsGlobalReportModalOpen(false);
  };

  const handleGlobalReportDateChange = (date: Date | null) => {
    setGlobalReportDate(toDateInputValue(date));
  };

  const handleDownloadGlobalReceipt = async () => {
    try {
      await waitForNextPaint();

      await downloadElementAsJpg({
        elementId: 'global-sales-receipt-content',
        fileName: `${globalReportDate.replace(/-/g, '_')}.jpg`,
        minWidth: 920,
        quality: 0.9,
      });
    } catch (error) {
      alert(`Gagal mengunduh struk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const TALAM_ONGOL_NAMES = new Set(['Talam Ketan Aren', 'Talam Ketan Pandan', 'Talam Pandan Aren', 'Ongol-Ongol']);

  const reportReceiptItems = useMemo(() => {
    const receiptMap = new Map<
      string,
      {
        id: string;
        item_name: string;
        stocks: number;
        solds: number;
        leftovers: number;
        covers: number;
        calculation_quantity: number;
        total_cost: number;
        item_base_prices: number[];
      }
    >();

    const REPORT_EXCLUDED_KEYWORDS = ['Cookies', 'Ubi', 'Telur'];

    (reportDetailRecords ?? []).forEach((item) => {
      if (item.is_free) {
        return;
      }

      if (REPORT_EXCLUDED_KEYWORDS.some((keyword) => item.item_name.includes(keyword))) {
        return;
      }

      const mappedName = TALAM_ONGOL_NAMES.has(item.item_name) ? 'Talam Ongol' : item.item_name;
      const current = receiptMap.get(mappedName);
      const calculationQuantity = item.is_ordered ? item.stocks : item.solds + item.covers;

      if (!current) {
        receiptMap.set(mappedName, {
          id: mappedName,
          item_name: mappedName,
          stocks: item.stocks,
          solds: item.solds,
          leftovers: item.leftovers ?? 0,
          covers: item.covers ?? 0,
          calculation_quantity: calculationQuantity,
          total_cost: item.total_cost,
          item_base_prices: [item.item_base_price],
        });
        return;
      }

      current.stocks += item.stocks;
      current.solds += item.solds;
      current.leftovers += item.leftovers ?? 0;
      current.covers += item.covers ?? 0;
      current.calculation_quantity += calculationQuantity;
      current.total_cost += item.total_cost;
      current.item_base_prices.push(item.item_base_price);
    });

    return Array.from(receiptMap.values());
  }, [reportDetailRecords]);

  const reportReceiptTotalCost = useMemo(
    () => reportReceiptItems.reduce((sum, item) => sum + item.total_cost, 0),
    [reportReceiptItems],
  );

  const globalReportReceiptItems = useMemo(() => {
    const REPORT_EXCLUDED_KEYWORDS = ['Cookies', 'Ubi', 'Telur'];

    const itemMap = new Map<
      string,
      {
        id: string;
        item_name: string;
        stocks: number;
        solds: number;
        leftovers: number;
        covers: number;
        calculation_quantity: number;
        total_cost: number;
        item_base_prices: number[];
      }
    >();

    (globalReportDetailRecords ?? []).forEach((item) => {
      if (item.is_free) {
        return;
      }

      if (REPORT_EXCLUDED_KEYWORDS.some((keyword) => item.item_name.includes(keyword))) {
        return;
      }

      const mappedName = TALAM_ONGOL_NAMES.has(item.item_name) ? 'Talam Ongol' : item.item_name;
      const current = itemMap.get(mappedName);
      const calculationQuantity = item.is_ordered ? item.stocks : item.solds + item.covers;

      if (!current) {
        itemMap.set(mappedName, {
          id: mappedName,
          item_name: mappedName,
          stocks: item.stocks,
          solds: item.solds,
          leftovers: item.leftovers ?? 0,
          covers: item.covers ?? 0,
          calculation_quantity: calculationQuantity,
          total_cost: item.total_cost,
          item_base_prices: [item.item_base_price],
        });
        return;
      }

      current.stocks += item.stocks;
      current.solds += item.solds;
      current.leftovers += item.leftovers ?? 0;
      current.covers += item.covers ?? 0;
      current.calculation_quantity += calculationQuantity;
      current.total_cost += item.total_cost;
      current.item_base_prices.push(item.item_base_price);
    });

    return Array.from(itemMap.values());
  }, [globalReportDetailRecords]);

  const globalReportGrandTotal = useMemo(
    () => globalReportReceiptItems.reduce((sum, item) => sum + item.total_cost, 0),
    [globalReportReceiptItems],
  );

  return (
    <div className="page-enter space-y-5">
      <div className="page-header">
        <nav className="text-xs text-slate-400" aria-label="Breadcrumb">
          <ol className="inline-flex list-none items-center gap-1.5 p-0">
            <li>Home</li>
            <li>/</li>
            <li>Sales</li>
            <li>/</li>
            <li className="font-semibold text-cyan-700">Office</li>
          </ol>
        </nav>
        <h1 className="page-title">Office Sales</h1>
        <p className="page-subtitle">Manage sales data for channel offices.</p>
      </div>

      <div className="glass-panel overflow-hidden rounded-xl border border-slate-200">
        {/* Toolbar */}
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
          {/* Location tabs */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {SELLING_LOCATIONS.map((location) => {
                const isActive = selectedLocationFilter === location;

                return (
                  <button
                    key={location}
                    type="button"
                    onClick={() => handleLocationFilterChange(location)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white text-cyan-700 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    {location}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Sort + Add */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <div className="inline-flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  { key: 'sales_date' as SortKey, dir: 'desc' as SortDirection, label: 'Newest' },
                  { key: 'sales_date' as SortKey, dir: 'asc' as SortDirection, label: 'Oldest' },
                  { key: 'total_solds' as SortKey, dir: 'desc' as SortDirection, label: 'Solds ↓' },
                  { key: 'total_leftovers' as SortKey, dir: 'desc' as SortDirection, label: 'Leftovers ↓' },
                  { key: 'is_saved' as SortKey, dir: 'asc' as SortDirection, label: 'Pending' },
                ] as { key: SortKey; dir: SortDirection; label: string }[]
              ).map(({ key, dir, label }) => {
                const isActive = sortKey === key && sortDirection === dir;
                return (
                  <button
                    key={`${key}.${dir}`}
                    type="button"
                    onClick={() => { setSortKey(key); setSortDirection(dir); setCurrentPage(1); }}
                    className={`inline-flex cursor-pointer items-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-white text-cyan-700 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleOpenGlobalReportModal}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
            >
              <FileText className="h-4 w-4" />
              Generate Report
            </button>
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

        {/* Card grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading office sales…</div>
        ) : records.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">No office sales found.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {records.map((record) => (
              <div
                key={record.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">{formatSalesDate(record.sales_date)}</p>
                    <p className="mt-0.5 truncate font-semibold text-slate-800">{record.selling_location}</p>
                  </div>
                  <span className={`mt-0.5 inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${record.is_saved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {record.is_saved ? 'Saved' : 'Pending'}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 divide-x divide-slate-100 px-1 py-3">
                  <div className="px-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Stocks</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-slate-800">{record.total_stocks}</p>
                  </div>
                  <div className="px-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Solds</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-cyan-600">{record.total_solds}</p>
                  </div>
                  <div className="px-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Left</p>
                    <p className={`mt-1 text-xl font-bold tabular-nums ${record.total_leftovers > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {record.total_leftovers}
                    </p>
                  </div>
                  <div className="px-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Covers</p>
                    <p className={`mt-1 text-xl font-bold tabular-nums ${record.total_covers ?? 0 > 0 ? 'text-violet-600' : 'text-slate-400'}`}>
                      {record.total_covers ?? 0}
                    </p>
                  </div>
                </div>

                {/* Sold / Left / Cover ratio bar */}
                {record.total_stocks > 0 && (() => {
                  const soldPct = Math.round((record.total_solds / record.total_stocks) * 100);
                  const leftPct = Math.round((record.total_leftovers / record.total_stocks) * 100);
                  const coverPct = Math.round(((record.total_covers ?? 0) / record.total_stocks) * 100);
                  return (
                    <div className="px-4 pb-3">
                      <div className="flex overflow-hidden rounded-full bg-slate-100" style={{ height: '6px' }}>
                        <div className="bg-cyan-500 transition-all" style={{ width: `${soldPct}%` }} />
                        <div className="bg-violet-400 transition-all" style={{ width: `${coverPct}%` }} />
                        <div className="bg-amber-400 transition-all" style={{ width: `${leftPct}%` }} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                          <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" />
                          Sold {soldPct}%
                        </span>
                        {coverPct > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                            <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
                            Cover {coverPct}%
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                          Left {leftPct}%
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="mt-auto flex gap-2 border-t border-slate-100 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(record)}
                    aria-label={`View detail for ${record.selling_location}`}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleOpenEditModal(record); }}
                    aria-label={`Edit ${record.selling_location}`}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-cyan-200 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={OFFICE_SALES_CARD_PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Office Sales Detail</h2>
                <p className="mt-0.5 text-sm text-slate-400">Sales summary and item list for this transaction.</p>
              </div>
              <div className="flex items-center gap-2">
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
              {/* Info cards row 1 */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Sales Date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{formatSalesDate(selectedRecord.sales_date)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Location</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{selectedRecord.selling_location}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Stocks</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{selectedRecord.total_stocks}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Solds</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{selectedRecord.total_solds}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Leftovers</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{selectedRecord.total_leftovers ?? '-'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Covers</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{selectedRecord.total_covers ?? '-'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Saved</p>
                  <div className="mt-1.5">
                    <span className={getStatusBadgeClassName(selectedRecord.is_saved, 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700')}>
                      {selectedRecord.is_saved ? 'Done' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info cards row 2 – financials */}
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Cost</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800"><span className={detailSensorClass}>{formatCurrency(selectedRecord.total_cost)}</span></p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Revenue</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800"><span className={detailSensorClass}>{formatCurrency(selectedRecord.total_revenue)}</span></p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Loss</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800"><span className={detailSensorClass}>{formatCurrency(selectedRecord.total_loss)}</span></p>
                </div>
                <div className={`rounded-xl border p-3 ${selectedRecord.net_income > 0 ? 'border-emerald-200 bg-emerald-50' : selectedRecord.net_income < 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Net Income</p>
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${selectedRecord.net_income > 0 ? 'bg-emerald-100 text-emerald-700' : selectedRecord.net_income < 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                      {selectedRecord.net_income > 0 ? <TrendingUp className="h-3 w-3" /> : selectedRecord.net_income < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {selectedRecord.net_income > 0 ? 'Profit' : selectedRecord.net_income < 0 ? 'Loss' : 'Even'}
                    </span>
                  </div>
                  <p className={`mt-1 text-sm font-bold tabular-nums ${selectedRecord.net_income > 0 ? 'text-emerald-700' : selectedRecord.net_income < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    <span className={detailSensorClass}>{formatCurrency(selectedRecord.net_income)}</span>
                  </p>
                </div>
              </div>

              {/* Items section */}
              <div className="mt-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Items</h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-400">Loading item details…</div>
                  ) : detailRecords.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-400">No item details found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="modern-table w-full min-w-[900px]">
                        <thead className="border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className="px-4 py-2.5 text-left">
                              <button type="button" onClick={() => handleDetailSort('item_name')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
                                Product <span className="tabular-nums">{getDetailSortIndicator('item_name')}</span>
                              </button>
                            </th>
                            <th className="px-4 py-2.5 text-left">
                              <button type="button" onClick={() => handleDetailSort('stocks')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
                                Stocks <span className="tabular-nums">{getDetailSortIndicator('stocks')}</span>
                              </button>
                            </th>
                            <th className="px-4 py-2.5 text-left">
                              <button type="button" onClick={() => handleDetailSort('solds')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
                                Solds <span className="tabular-nums">{getDetailSortIndicator('solds')}</span>
                              </button>
                            </th>
                            <th className="px-4 py-2.5 text-left">
                              <button type="button" onClick={() => handleDetailSort('leftovers')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
                                Leftovers <span className="tabular-nums">{getDetailSortIndicator('leftovers')}</span>
                              </button>
                            </th>
                            <th className="px-4 py-2.5 text-left">
                              <button type="button" onClick={() => handleDetailSort('is_ordered')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
                                Ordered <span className="tabular-nums">{getDetailSortIndicator('is_ordered')}</span>
                              </button>
                            </th>
                            <th className="px-4 py-2.5 text-left">
                              <button type="button" onClick={() => handleDetailSort('is_free')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
                                Free <span className="tabular-nums">{getDetailSortIndicator('is_free')}</span>
                              </button>
                            </th>
                            <th className="px-4 py-2.5 text-left">
                              <button type="button" onClick={() => handleDetailSort('total_cost')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
                                Cost <span className="tabular-nums">{getDetailSortIndicator('total_cost')}</span>
                              </button>
                            </th>
                            <th className="px-4 py-2.5 text-left">
                              <button type="button" onClick={() => handleDetailSort('total_revenue')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
                                Revenue <span className="tabular-nums">{getDetailSortIndicator('total_revenue')}</span>
                              </button>
                            </th>
                            <th className="px-4 py-2.5 text-left">
                              <button type="button" onClick={() => handleDetailSort('total_loss')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
                                Loss <span className="tabular-nums">{getDetailSortIndicator('total_loss')}</span>
                              </button>
                            </th>
                            <th className="px-4 py-2.5 text-left">
                              <button type="button" onClick={() => handleDetailSort('net_income')} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
                                Net <span className="tabular-nums">{getDetailSortIndicator('net_income')}</span>
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detailRecords.map((detail, index) => (
                            <tr key={`${detail.item_name}-${index}`} className="hover:bg-slate-50/60">
                              <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-slate-800">{detail.item_name}</td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700">{detail.stocks}</td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700">{detail.solds}</td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700">{detail.leftovers ?? '-'}</td>
                              <td className="whitespace-nowrap px-4 py-2.5">
                                <span title={detail.is_ordered ? 'Ordered' : 'Not Ordered'} aria-label={detail.is_ordered ? 'Ordered' : 'Not Ordered'} className={`inline-flex ${detail.is_ordered ? 'text-emerald-500' : 'text-rose-400'}`}>
                                  {detail.is_ordered ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5">
                                <span title={detail.is_free ? 'Free' : 'Paid'} aria-label={detail.is_free ? 'Free' : 'Paid'} className={`inline-flex ${detail.is_free ? 'text-emerald-500' : 'text-rose-400'}`}>
                                  {detail.is_free ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700"><span className={detailSensorClass}>{formatCurrency(detail.total_cost)}</span></td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700"><span className={detailSensorClass}>{formatCurrency(detail.total_revenue)}</span></td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700"><span className={detailSensorClass}>{formatCurrency(detail.total_loss)}</span></td>
                              <td className="whitespace-nowrap px-4 py-2.5">
                                <span className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${detail.net_income > 0 ? 'text-emerald-600' : detail.net_income < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                  {detail.net_income > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : detail.net_income < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                                  <span className={detailSensorClass}>{formatCurrency(detail.net_income)}</span>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!detailLoading && detailRecords.length > 0 && (
                    <Pagination
                      currentPage={detailCurrentPage}
                      totalItems={detailTotalItems}
                      pageSize={PAGE_SIZE}
                      onPageChange={setDetailCurrentPage}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={handleCloseDetail}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add Office Sales</h2>
                <p className="mt-0.5 text-sm text-slate-400">Create a new office sales record with item details.</p>
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

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5">
                {/* Date + Location */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Sales Date</label>
                    <div className="relative" onClick={() => openDatePicker(addSalesDateRef.current)}>
                      <input
                        type="text"
                        value={addFormData.sales_date ? formatSalesDate(addFormData.sales_date) : ''}
                        readOnly
                        placeholder="dddd, dd mmmm yyyy"
                        className="modern-input w-full cursor-pointer px-3 py-2 text-sm text-slate-800"
                      />
                      <input
                        ref={addSalesDateRef}
                        type="date"
                        value={addFormData.sales_date}
                        onChange={(e) => handleAddSalesDateChange(e.target.value)}
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Selling Location</label>
                    <Select<LocationSelectOption, false>
                      options={addLocationOptions}
                      value={selectedAddLocationOption}
                      onChange={handleAddLocationSelectChange}
                      onInputChange={handleAddLocationSearchInputChange}
                      isSearchable
                      isClearable
                      placeholder="Select or search selling location"
                      formatOptionLabel={(option) => (
                        <span>{renderHighlightedLabel(option.label, locationSearchKeyword)}</span>
                      )}
                      noOptionsMessage={() => 'Selling location not found'}
                      classNames={getReactSelectClassNames(false, false)}
                    />
                  </div>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Stocks</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{addSummaryTotals.totalStocks}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Solds</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{addSummaryTotals.totalSolds}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Leftovers</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{addSummaryTotals.totalLeftovers}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Covers</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{addSummaryTotals.totalCovers}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Cost</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800"><span className={addSensorClass}>{formatCurrency(addSummaryTotals.totalCost)}</span></p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Revenue</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800"><span className={addSensorClass}>{formatCurrency(addSummaryTotals.totalRevenue)}</span></p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Loss</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800"><span className={addSensorClass}>{formatCurrency(addSummaryTotals.totalLoss)}</span></p>
                  </div>
                  <div className={`rounded-xl border p-3 ${addSummaryTotals.netIncome > 0 ? 'border-emerald-200 bg-emerald-50' : addSummaryTotals.netIncome < 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Net Income</p>
                    <p className={`mt-1 text-sm font-bold tabular-nums ${addSummaryTotals.netIncome > 0 ? 'text-emerald-700' : addSummaryTotals.netIncome < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      <span className={addSensorClass}>{formatCurrency(addSummaryTotals.netIncome)}</span>
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Items</h3>
                      <p className="mt-0.5 text-xs text-slate-400">Active office pricing items for the selected location.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Row
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    {addFormItems.length === 0 ? (
                      <div className="flex items-center justify-center py-10 text-sm text-slate-400">No items yet. Click Add Row to start.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className={`modern-table w-full ${isAddSensorOn ? 'min-w-[830px]' : 'min-w-[1270px]'}`}>
                          <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                              <th className="w-[300px] min-w-[300px] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                              <th className="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stocks</th>
                              <th className="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Solds</th>
                              <th className="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Covers</th>
                              <th className="w-24 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Leftovers</th>
                              <th className="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Ordered</th>
                              <th className="w-16 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Free</th>
                              {!isAddSensorOn && <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Cost</th>}
                              {!isAddSensorOn && <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</th>}
                              {!isAddSensorOn && <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Loss</th>}
                              {!isAddSensorOn && <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Net</th>}
                              <th className="w-12 px-3 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedAddFormItems.map((item) => {
                              const computed = getAddItemComputedValues(item);

                              return (
                                <tr key={item.id}>
                                  <td className="w-[300px] min-w-[300px] px-3 py-3">
                                    <Select<AddOfficePricingOption, false>
                                      options={addOfficePricingOptions}
                                      value={addOfficePricingOptions.find((option) => option.value === item.office_pricing_id) ?? null}
                                      onChange={(selected) => handleItemChange(item.id, 'office_pricing_id', selected?.value ?? '')}
                                      onInputChange={(value, meta) => handleAddProductSearchInputChange(item.id, value, meta)}
                                      isSearchable
                                      isClearable
                                      menuPlacement="top"
                                      menuPosition="fixed"
                                      menuPortalTarget={document.body}
                                      placeholder="Select product"
                                      formatOptionLabel={(option) => (
                                        <span>{renderHighlightedLabel(option.label, productSearchKeyword[item.id] ?? '')}</span>
                                      )}
                                      noOptionsMessage={() => 'Product not found'}
                                      classNames={getReactSelectClassNames(false, false)}
                                      styles={{ menuPortal: (base) => ({ ...base, zIndex: 80 }) }}
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={item.stocks === 0 ? '' : item.stocks}
                                      onChange={(e) => handleItemChange(item.id, 'stocks', parseNumberInput(e.target.value))}
                                      placeholder="0"
                                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-200"
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={item.solds === 0 ? '' : item.solds}
                                      onChange={(e) => handleItemChange(item.id, 'solds', parseNumberInput(e.target.value))}
                                      placeholder="0"
                                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-200"
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={item.covers === 0 ? '' : item.covers}
                                      onChange={(e) => handleItemChange(item.id, 'covers', parseNumberInput(e.target.value))}
                                      placeholder="0"
                                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-200"
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      type="number"
                                      value={item.leftovers}
                                      disabled
                                      className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500"
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <button
                                      type="button"
                                      onClick={() => handleItemChange(item.id, 'is_ordered', !item.is_ordered)}
                                      className={`inline-flex h-6 w-11 cursor-pointer items-center rounded-full p-0.5 transition-colors ${item.is_ordered ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                      role="switch"
                                      aria-checked={item.is_ordered}
                                    >
                                      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${item.is_ordered ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                  </td>
                                  <td className="px-3 py-3">
                                    <button
                                      type="button"
                                      onClick={() => handleItemChange(item.id, 'is_free', !item.is_free)}
                                      className={`inline-flex h-6 w-11 cursor-pointer items-center rounded-full p-0.5 transition-colors ${item.is_free ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                      role="switch"
                                      aria-checked={item.is_free}
                                    >
                                      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${item.is_free ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                  </td>
                                  {!isAddSensorOn && (
                                    <td className="px-3 py-3">
                                      <input type="text" disabled value={formatCurrency(computed.totalCost)} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500" />
                                    </td>
                                  )}
                                  {!isAddSensorOn && (
                                    <td className="px-3 py-3">
                                      <input type="text" disabled value={formatCurrency(computed.totalRevenue)} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500" />
                                    </td>
                                  )}
                                  {!isAddSensorOn && (
                                    <td className="px-3 py-3">
                                      <input type="text" disabled value={formatCurrency(computed.totalLoss)} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500" />
                                    </td>
                                  )}
                                  {!isAddSensorOn && (
                                    <td className="px-3 py-3">
                                      <input type="text" disabled value={formatCurrency(computed.netIncome)} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500" />
                                    </td>
                                  )}
                                  <td className="px-3 py-3">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRow(item.id)}
                                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                      title="Remove row"
                                      aria-label="Remove row"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
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

            {/* Footer */}
            <div className="flex flex-shrink-0 gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={handleCloseAddModal}
                disabled={isAddSubmitting}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAddForm}
                disabled={isAddSubmitting}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {isAddSubmitting ? 'Creating…' : 'Create Sales'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Office Sales</h2>
                <p className="mt-0.5 text-sm text-slate-400">Update existing office sales data and item details.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditSensorOn((prev) => !prev)}
                  title={isEditSensorOn ? 'Show financials' : 'Hide financials'}
                  aria-label={isEditSensorOn ? 'Show financials' : 'Hide financials'}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isEditSensorOn
                      ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                  }`}
                >
                  {isEditSensorOn ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {isEditSensorOn ? 'Sensor On' : 'Sensor Off'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  disabled={isEditSubmitting}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isEditLoading ? (
              <div className="flex flex-1 items-center justify-center py-16 text-sm text-slate-400">Loading sales details…</div>
            ) : (
              <>
                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className="space-y-5">
                    {/* Date + Location */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Sales Date</label>
                        <div className="relative" onClick={() => openDatePicker(editSalesDateRef.current)}>
                          <input
                            type="text"
                            value={editFormData.sales_date ? formatSalesDate(editFormData.sales_date) : ''}
                            readOnly
                            placeholder="dddd, dd mmmm yyyy"
                            className="modern-input w-full cursor-pointer px-3 py-2 text-sm text-slate-800"
                          />
                          <input
                            ref={editSalesDateRef}
                            type="date"
                            value={editFormData.sales_date}
                            onChange={(e) => handleEditSalesDateChange(e.target.value)}
                            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Selling Location</label>
                        <Select<LocationSelectOption, false>
                          options={addLocationOptions}
                          value={selectedEditLocationOption}
                          onChange={handleEditLocationSelectChange}
                          onInputChange={handleEditLocationSearchInputChange}
                          isSearchable
                          isClearable
                          placeholder="Select or search selling location"
                          formatOptionLabel={(option) => (
                            <span>{renderHighlightedLabel(option.label, editLocationSearchKeyword)}</span>
                          )}
                          noOptionsMessage={() => 'Selling location not found'}
                          classNames={getReactSelectClassNames(false, false)}
                        />
                      </div>
                    </div>

                    {/* Summary stats */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Stocks</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{editSummaryTotals.totalStocks}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Solds</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{editSummaryTotals.totalSolds}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Leftovers</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{editSummaryTotals.totalLeftovers}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Covers</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{editSummaryTotals.totalCovers}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Cost</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800"><span className={editSensorClass}>{formatCurrency(editSummaryTotals.totalCost)}</span></p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Revenue</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800"><span className={editSensorClass}>{formatCurrency(editSummaryTotals.totalRevenue)}</span></p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Loss</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800"><span className={editSensorClass}>{formatCurrency(editSummaryTotals.totalLoss)}</span></p>
                      </div>
                      <div className={`rounded-xl border p-3 ${editSummaryTotals.netIncome > 0 ? 'border-emerald-200 bg-emerald-50' : editSummaryTotals.netIncome < 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Net Income</p>
                        <p className={`mt-1 text-sm font-bold tabular-nums ${editSummaryTotals.netIncome > 0 ? 'text-emerald-700' : editSummaryTotals.netIncome < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                          <span className={editSensorClass}>{formatCurrency(editSummaryTotals.netIncome)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">Items</h3>
                          <p className="mt-0.5 text-xs text-slate-400">Edit mapped items for this office sales record.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleEditRow}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Row
                        </button>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        {editFormItems.length === 0 ? (
                          <div className="flex items-center justify-center py-10 text-sm text-slate-400">No items. Click Add Row to start.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className={`modern-table w-full ${isEditSensorOn ? 'min-w-[830px]' : 'min-w-[1270px]'}`}>
                              <thead className="border-b border-slate-200 bg-slate-50">
                                <tr>
                                  <th className="w-[300px] min-w-[300px] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                                  <th className="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stocks</th>
                                  <th className="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Solds</th>
                                  <th className="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Covers</th>
                                  <th className="w-24 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Leftovers</th>
                                  <th className="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Ordered</th>
                                  <th className="w-16 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Free</th>
                                  {!isEditSensorOn && <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Cost</th>}
                                  {!isEditSensorOn && <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</th>}
                                  {!isEditSensorOn && <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Loss</th>}
                                  {!isEditSensorOn && <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Net</th>}
                                  <th className="w-12 px-3 py-2.5"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {paginatedEditFormItems.map((item) => {
                                  const computed = getEditItemComputedValues(item);

                                  return (
                                    <tr key={item.id}>
                                      <td className="w-[300px] min-w-[300px] px-3 py-3">
                                        <Select<AddOfficePricingOption, false>
                                          options={editOfficePricingOptions}
                                          value={editOfficePricingOptions.find((option) => option.value === item.office_pricing_id) ?? null}
                                          onChange={(selected) => handleEditItemChange(item.id, 'office_pricing_id', selected?.value ?? '')}
                                          onInputChange={(value, meta) => handleEditProductSearchInputChange(item.id, value, meta)}
                                          isSearchable
                                          isClearable
                                          menuPlacement="top"
                                          menuPosition="fixed"
                                          menuPortalTarget={document.body}
                                          placeholder="Select product"
                                          formatOptionLabel={(option) => (
                                            <span>{renderHighlightedLabel(option.label, editProductSearchKeyword[item.id] ?? '')}</span>
                                          )}
                                          noOptionsMessage={() => 'Product not found'}
                                          classNames={getReactSelectClassNames(false, false)}
                                          styles={{ menuPortal: (base) => ({ ...base, zIndex: 80 }) }}
                                        />
                                      </td>
                                      <td className="px-3 py-3">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          value={item.stocks === 0 ? '' : item.stocks}
                                          onChange={(e) => handleEditItemChange(item.id, 'stocks', parseNumberInput(e.target.value))}
                                          placeholder="0"
                                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-200"
                                        />
                                      </td>
                                      <td className="px-3 py-3">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          value={item.solds === 0 ? '' : item.solds}
                                          onChange={(e) => handleEditItemChange(item.id, 'solds', parseNumberInput(e.target.value))}
                                          placeholder="0"
                                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-200"
                                        />
                                      </td>
                                      <td className="px-3 py-3">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          value={item.covers === 0 ? '' : item.covers}
                                          onChange={(e) => handleEditItemChange(item.id, 'covers', parseNumberInput(e.target.value))}
                                          placeholder="0"
                                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-200"
                                        />
                                      </td>
                                      <td className="px-3 py-3">
                                        <input
                                          type="number"
                                          value={item.leftovers}
                                          disabled
                                          className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500"
                                        />
                                      </td>
                                      <td className="px-3 py-3">
                                        <button
                                          type="button"
                                          onClick={() => handleEditItemChange(item.id, 'is_ordered', !item.is_ordered)}
                                          className={`inline-flex h-6 w-11 cursor-pointer items-center rounded-full p-0.5 transition-colors ${item.is_ordered ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                          role="switch"
                                          aria-checked={item.is_ordered}
                                        >
                                          <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${item.is_ordered ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                      </td>
                                      <td className="px-3 py-3">
                                        <button
                                          type="button"
                                          onClick={() => handleEditItemChange(item.id, 'is_free', !item.is_free)}
                                          className={`inline-flex h-6 w-11 cursor-pointer items-center rounded-full p-0.5 transition-colors ${item.is_free ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                          role="switch"
                                          aria-checked={item.is_free}
                                        >
                                          <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${item.is_free ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                      </td>
                                      {!isEditSensorOn && (
                                        <td className="px-3 py-3">
                                          <input type="text" disabled value={formatCurrency(computed.totalCost)} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500" />
                                        </td>
                                      )}
                                      {!isEditSensorOn && (
                                        <td className="px-3 py-3">
                                          <input type="text" disabled value={formatCurrency(computed.totalRevenue)} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500" />
                                        </td>
                                      )}
                                      {!isEditSensorOn && (
                                        <td className="px-3 py-3">
                                          <input type="text" disabled value={formatCurrency(computed.totalLoss)} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500" />
                                        </td>
                                      )}
                                      {!isEditSensorOn && (
                                        <td className="px-3 py-3">
                                          <input type="text" disabled value={formatCurrency(computed.netIncome)} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-500" />
                                        </td>
                                      )}
                                      <td className="px-3 py-3">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveEditRow(item.id)}
                                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                          title="Remove row"
                                          aria-label="Remove row"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {editFormItems.length > 0 && (
                          <Pagination
                            currentPage={editItemsCurrentPage}
                            totalItems={editFormItems.length}
                            pageSize={ADD_ITEMS_PAGE_SIZE}
                            onPageChange={setEditItemsCurrentPage}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-shrink-0 gap-3 border-t border-slate-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    disabled={isEditSubmitting}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitEditForm}
                    disabled={isEditSubmitting}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {isEditSubmitting ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {reportRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex max-h-[94vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sales Report</h2>
                <p className="mt-0.5 text-sm text-slate-400">Preview receipt before downloading.</p>
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
                <div className="flex items-center justify-center py-12 text-sm text-slate-400">Loading report data…</div>
              ) : (
                <div id="office-sales-receipt-content" className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
                  <div className="border-b border-dashed border-slate-300 pb-3 text-center">
                    <h3 className="text-base font-bold text-slate-900">Penjualan Aneka Kue 339</h3>
                    <p className="mt-0.5 text-sm font-medium text-slate-600">{formatReceiptDateTitle(reportRecord.sales_date)}</p>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stok</th>
                          <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Produk</th>
                          <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Terjual</th>
                          <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Perhitungan</th>
                          <th className="py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportReceiptItems.map((item) => {
                          const leftovers = item.leftovers ?? 0;
                          const isSoldOut = leftovers <= 0;
                          const leftoverText = leftovers > 0 ? `(sisa ${leftovers})` : '(habis)';
                          const uniqueBasePrices = Array.from(new Set(item.item_base_prices));
                          const remarks = uniqueBasePrices.length === 1
                            ? `${item.calculation_quantity} x ${new Intl.NumberFormat('id-ID').format(uniqueBasePrices[0] ?? 0)}`
                            : `${item.calculation_quantity} x campuran`;

                          return (
                            <tr key={item.id} className="border-b border-slate-100">
                              <td className="py-2 pr-3 text-sm text-slate-700">{item.stocks}</td>
                              <td className="py-2 pr-3 text-sm font-medium text-slate-800">{item.item_name}</td>
                              <td className={`py-2 pr-3 text-sm font-semibold ${isSoldOut ? 'text-emerald-600' : 'text-rose-500'}`}>{leftoverText}</td>
                              <td className="py-2 pr-3 text-sm text-slate-500">{remarks}</td>
                              <td className="py-2 text-right text-sm font-medium text-slate-800">{formatCurrency(item.total_cost)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 border-t border-dashed border-slate-300 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">Total</span>
                      <span className="text-base font-bold text-slate-900">{formatCurrency(reportReceiptTotalCost)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isReportDetailLoading && !isReportDetailFetching && (
              <div className="flex-shrink-0 border-t border-slate-100 px-5 py-4">
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
          </div>
        </div>
      )}

      {isGlobalReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex max-h-[94vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Generate Report</h2>
                <p className="mt-0.5 text-sm text-slate-400">Preview and download daily report across all locations.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseGlobalReportModal}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Date filter */}
            <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-3">
              <label className="text-sm font-semibold text-slate-600 whitespace-nowrap">Sales Date</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={globalReportDate ? formatSalesDate(globalReportDate) : ''}
                  readOnly
                  placeholder="dddd, dd mmmm yyyy"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800"
                />
                <DatePicker
                  selected={parseDateInputValue(globalReportDate)}
                  onChange={handleGlobalReportDateChange}
                  dateFormat="yyyy-MM-dd"
                  customInput={<CalendarTriggerButton />}
                  calendarClassName="office-datepicker"
                  popperClassName="office-datepicker-popper z-[90]"
                  popperPlacement="bottom-end"
                  showPopperArrow={false}
                  onKeyDown={(event) => event.preventDefault()}
                />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {(isGlobalReportSalesLoading || isGlobalReportSalesFetching || isGlobalReportDetailLoading || isGlobalReportDetailFetching) ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-400">Loading report data…</div>
              ) : !globalReportDate ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-400">Select a date to generate the report.</div>
              ) : (globalReportSalesRecords ?? []).length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-400">No sales data found for this date.</div>
              ) : (
                <div id="global-sales-receipt-content" className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
                  {/* Receipt header */}
                  <div className="border-b border-dashed border-slate-300 pb-3 text-center">
                    <h3 className="text-base font-bold text-slate-900">Penjualan Aneka Kue 339</h3>
                    <p className="mt-0.5 text-sm font-medium text-slate-600">{formatReceiptDateTitle(globalReportDate)}</p>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stok</th>
                          <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Produk</th>
                          <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Terjual</th>
                          <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Perhitungan</th>
                          <th className="py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalReportReceiptItems.map((item) => {
                          const leftovers = item.leftovers ?? 0;
                          const isSoldOut = leftovers <= 0;
                          const leftoverText = leftovers > 0 ? `(sisa ${leftovers})` : '(habis)';
                          const uniqueBasePrices = Array.from(new Set(item.item_base_prices));
                          const remarks = uniqueBasePrices.length === 1
                            ? `${item.calculation_quantity} x ${new Intl.NumberFormat('id-ID').format(uniqueBasePrices[0] ?? 0)}`
                            : `${item.calculation_quantity} x campuran`;

                          return (
                            <tr key={item.id} className="border-b border-slate-100">
                              <td className="py-2 pr-3 text-sm text-slate-700">{item.stocks}</td>
                              <td className="py-2 pr-3 text-sm font-medium text-slate-800">{item.item_name}</td>
                              <td className={`py-2 pr-3 text-sm font-semibold ${isSoldOut ? 'text-emerald-600' : 'text-rose-500'}`}>{leftoverText}</td>
                              <td className="py-2 pr-3 text-sm text-slate-500">{remarks}</td>
                              <td className="py-2 text-right text-sm font-medium text-slate-800">{formatCurrency(item.total_cost)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 border-t border-dashed border-slate-300 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">Total</span>
                      <span className="text-base font-bold text-slate-900">{formatCurrency(globalReportGrandTotal)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isGlobalReportSalesLoading && !isGlobalReportSalesFetching && !isGlobalReportDetailLoading && !isGlobalReportDetailFetching && (globalReportSalesRecords ?? []).length > 0 && (
              <div className="flex-shrink-0 border-t border-slate-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => { void handleDownloadGlobalReceipt(); }}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-700"
                >
                  <Download className="h-4 w-4" />
                  Download JPG
                </button>
              </div>
            )}
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

export default SalesOffice;
