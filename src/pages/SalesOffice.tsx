import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, Download, Eye, EyeOff, FileText, MapPin, Minus, Pencil, Plus, Save, TrendingDown, TrendingUp, X, XCircle, Trash2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import Select, { type InputActionMeta, type SingleValue } from 'react-select';
import Pagination from '../components/Pagination';
import { SELLING_LOCATIONS } from '../constants/sellingLocations';
import { ADD_ITEMS_PAGE_SIZE, OFFICE_SALES_API_URL, OFFICE_SALES_DETAIL_API_URL, OFFICE_SALES_DETAIL_WRITE_API_URL } from '../constants/officeSales';
import { PAGE_SIZE, formatCurrency, formatDisplayDate, getStatusBadgeClassName, parseNumberInput, toNullIfZero } from '../utils/helper';
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
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OfficeSalesRecord | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
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

  const queryClient = useQueryClient();

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
      const offset = (currentPage - 1) * PAGE_SIZE;
      const params = new URLSearchParams({
        select: '*',
        limit: String(PAGE_SIZE),
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
        : option.base_price * item.solds;
    const totalRevenue = option.selling_price * item.solds;
    const totalLoss = item.is_ordered ? option.base_price * item.leftovers : null;
    const netIncome = item.is_free ? totalRevenue : option.profit * item.solds - (totalLoss ?? 0);

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
        : option.base_price * item.solds;
    const totalRevenue = option.selling_price * item.solds;
    const totalLoss = item.is_ordered ? option.base_price * item.leftovers : null;
    const netIncome = item.is_free ? totalRevenue : option.profit * item.solds - (totalLoss ?? 0);

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
        acc.totalCost += computed.totalCost ?? 0;
        acc.totalRevenue += computed.totalRevenue;
        acc.totalLoss += computed.totalLoss ?? 0;
        acc.netIncome += computed.netIncome;

        return acc;
      },
      {
        totalStocks: 0,
        totalSolds: 0,
        totalLeftovers: 0,
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
        acc.totalCost += computed.totalCost ?? 0;
        acc.totalRevenue += computed.totalRevenue;
        acc.totalLoss += computed.totalLoss ?? 0;
        acc.netIncome += computed.netIncome;

        return acc;
      },
      {
        totalStocks: 0,
        totalSolds: 0,
        totalLeftovers: 0,
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

  const handleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      setCurrentPage(1);
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
    setCurrentPage(1);
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return '\u2195';
    }

    return sortDirection === 'asc' ? '\u2191' : '\u2193';
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

  const handleCloseDetail = () => {
    setSelectedRecord(null);
    setDetailCurrentPage(1);
  };

  const handleOpenReportModal = (record: OfficeSalesRecord) => {
    setReportRecord(record);
  };

  const handleCloseReportModal = () => {
    setReportRecord(null);
  };

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
    setIsAddSensorOn(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setAddFormData({ sales_date: defaultSalesDate, selling_location: defaultLocationFilter });
    setAddFormItems([]);
    setAddItemsCurrentPage(1);
    setLocationSearchKeyword('');
    setProductSearchKeyword({});
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

  const handleCloseEditModal = () => {
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

        if (field === 'stocks' || field === 'solds') {
          updated.leftovers = Math.max(updated.stocks - updated.solds, 0);
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

        if (field === 'stocks' || field === 'solds') {
          updated.leftovers = Math.max(updated.stocks - updated.solds, 0);
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
    if (!addFormData.sales_date || !addFormData.selling_location || addFormItems.length === 0) {
      alert('Please fill in Sales Date, Selling Location, and add at least one item.');
      return;
    }

    const hasInvalidItem = addFormItems.some((item) => !item.office_pricing_id);
    if (hasInvalidItem) {
      alert('Please select Product for all item rows.');
      return;
    }

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
      handleCloseAddModal();
    } catch (error) {
      console.error('Error submitting add office sales:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSubmitEditForm = async () => {
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
      handleCloseEditModal();
    } catch (error) {
      console.error('Error submitting edit office sales:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isAddModalOpen, isEditModalOpen, selectedRecord, reportRecord]);

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
    const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(date).toLowerCase().replace(/\s+/g, '_');
    const day = String(date.getDate()).padStart(2, '0');
    const month = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(date).toLowerCase().replace(/\s+/g, '_');
    const year = String(date.getFullYear());

    return `${weekday}_${day}_${month}_${year}.png`;
  };

  const handleDownloadReceipt = async () => {
    if (!reportRecord) {
      return;
    }

    const receiptElement = document.getElementById('office-sales-receipt-content');
    if (!receiptElement) {
      alert('Konten struk tidak ditemukan.');
      return;
    }

    try {
      const dataUrl = await toPng(receiptElement, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = formatReceiptFileName(reportRecord.sales_date);
      link.click();
    } catch (error) {
      alert(`Gagal mengunduh struk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const detailSensorClass = isDetailSensorOn ? 'select-none blur-sm' : '';
  const addSensorClass = isAddSensorOn ? 'select-none blur-sm' : '';
  const editSensorClass = isEditSensorOn ? 'select-none blur-sm' : '';

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
        total_cost: number;
        item_base_prices: number[];
      }
    >();

    (reportDetailRecords ?? []).forEach((item) => {
      const mappedName = TALAM_ONGOL_NAMES.has(item.item_name) ? 'Talam Ongol' : item.item_name;
      const current = receiptMap.get(mappedName);

      if (!current) {
        receiptMap.set(mappedName, {
          id: mappedName,
          item_name: mappedName,
          stocks: item.stocks,
          solds: item.solds,
          leftovers: item.leftovers ?? 0,
          total_cost: item.total_cost,
          item_base_prices: [item.item_base_price],
        });
        return;
      }

      current.stocks += item.stocks;
      current.solds += item.solds;
      current.leftovers += item.leftovers ?? 0;
      current.total_cost += item.total_cost;
      current.item_base_prices.push(item.item_base_price);
    });

    return Array.from(receiptMap.values());
  }, [reportDetailRecords]);

  return (
    <div className="page-enter space-y-6">
      <div className="page-header">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="inline-flex list-none flex-wrap items-center gap-2 p-0">
            <li>Home</li>
            <li>/</li>
            <li className="font-semibold text-slate-900">Sales</li>
            <li>/</li>
            <li className="font-semibold uppercase tracking-[0.08em] text-cyan-800">Office</li>
          </ol>
        </nav>
        <h1 className="page-title">Office Sales</h1>
        <p className="page-subtitle">Kelola data penjualan untuk channel office secara terstruktur.</p>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl border border-cyan-100">
        <div className="flex items-center justify-between border-b border-cyan-100 px-4 py-3 sm:px-6">
          <div className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-cyan-50 p-1">
            {SELLING_LOCATIONS.map((location) => {
              const isActive = selectedLocationFilter === location;

              return (
                <button
                  key={location}
                  type="button"
                  onClick={() => handleLocationFilterChange(location)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white text-cyan-800 shadow-sm ring-1 ring-cyan-200'
                      : 'text-slate-600 hover:bg-white/70 hover:text-cyan-700'
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {location}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="modern-primary flex cursor-pointer items-center justify-center gap-2 px-4 py-2 font-medium"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading office sales...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="modern-table w-full min-w-[980px]">
              <thead className="border-b border-cyan-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('sales_date')} className="inline-flex cursor-pointer items-center gap-1">
                      Sales Date <span>{getSortIndicator('sales_date')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('selling_location')} className="inline-flex cursor-pointer items-center gap-1">
                      Selling Location <span>{getSortIndicator('selling_location')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('total_stocks')} className="inline-flex cursor-pointer items-center gap-1">
                      Total Stocks <span>{getSortIndicator('total_stocks')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('total_solds')} className="inline-flex cursor-pointer items-center gap-1">
                      Total Solds <span>{getSortIndicator('total_solds')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('total_leftovers')} className="inline-flex cursor-pointer items-center gap-1">
                      Total Leftovers <span>{getSortIndicator('total_leftovers')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('is_saved')} className="inline-flex cursor-pointer items-center gap-1">
                      Saved <span>{getSortIndicator('is_saved')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-50 bg-white/80">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{formatDisplayDate(record.sales_date)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.selling_location}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.total_stocks}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.total_solds}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.total_leftovers}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          record.is_saved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {record.is_saved ? 'Saved' : 'Pending'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(record)}
                          title="View detail"
                          aria-label={`View detail for ${record.selling_location} at ${record.sales_date}`}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleOpenEditModal(record);
                          }}
                          title="Edit data"
                          aria-label={`Edit data for ${record.selling_location} at ${record.sales_date}`}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-cyan-300 text-cyan-700 transition-colors hover:bg-cyan-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReportModal(record)}
                          title="Generate report"
                          aria-label={`Generate report for ${record.selling_location} at ${record.sales_date}`}
                          className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-violet-300 px-3 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="p-10 text-center text-slate-500">No office sales found.</div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-[min(96vw,1560px)] max-w-none overflow-y-auto rounded-2xl border border-cyan-100 bg-white/95 p-5 shadow-2xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Office Sales Detail</h2>
                <p className="mt-1 text-sm text-slate-500">Sales data summary and item list for selected transactions.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDetailSensorOn((prev) => !prev)}
                  title={isDetailSensorOn ? 'Tampilkan nilai finansial' : 'Sembunyikan nilai finansial'}
                  aria-label={isDetailSensorOn ? 'Tampilkan nilai finansial' : 'Sembunyikan nilai finansial'}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    isDetailSensorOn
                      ? 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      : 'border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                  }`}
                >
                  {isDetailSensorOn ? <EyeOff size={16} /> : <Eye size={16} />}
                  {isDetailSensorOn ? 'Sensor: On' : 'Sensor: Off'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100"
                  aria-label="Close detail modal"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sales Date</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{formatDisplayDate(selectedRecord.sales_date)}</p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selling Location</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedRecord.selling_location}</p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Stocks</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedRecord.total_stocks}</p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Solds</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedRecord.total_solds}</p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Leftovers</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedRecord.total_leftovers ?? '-'}</p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Saved</p>
                  <div className="mt-2">
                    <span className={getStatusBadgeClassName(selectedRecord.is_saved, 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800')}>
                      {selectedRecord.is_saved ? 'Done' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Cost</p>
                  <p className="mt-1 text-sm font-medium text-slate-900"><span className={detailSensorClass}>{formatCurrency(selectedRecord.total_cost)}</span></p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Revenue</p>
                  <p className="mt-1 text-sm font-medium text-slate-900"><span className={detailSensorClass}>{formatCurrency(selectedRecord.total_revenue)}</span></p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Loss</p>
                  <p className="mt-1 text-sm font-medium text-slate-900"><span className={detailSensorClass}>{formatCurrency(selectedRecord.total_loss)}</span></p>
                </div>
                <div
                  className={`rounded-xl border p-4 shadow-sm ${
                    selectedRecord.net_income > 0
                      ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50'
                      : selectedRecord.net_income < 0
                        ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50'
                        : 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Income</p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        selectedRecord.net_income > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedRecord.net_income < 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {selectedRecord.net_income > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : selectedRecord.net_income < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      {selectedRecord.net_income > 0 ? 'Profit' : selectedRecord.net_income < 0 ? 'Loss' : 'Break Even'}
                    </span>
                  </div>
                  <p
                    className={`mt-2 text-lg font-bold ${
                      selectedRecord.net_income > 0 ? 'text-emerald-700' : selectedRecord.net_income < 0 ? 'text-rose-700' : 'text-slate-700'
                    }`}
                  >
                    <span className={detailSensorClass}>{formatCurrency(selectedRecord.net_income)}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Items</h3>
                <p className="mt-1 text-sm text-slate-500">List of items from the office sales detail view for this data.</p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-cyan-100">
                {detailLoading ? (
                  <div className="p-10 text-center text-slate-500">Loading item details...</div>
                ) : detailRecords.length === 0 ? (
                  <div className="p-10 text-center text-slate-500">No item details found.</div>
                ) : (
                  <div>
                    <table className="modern-table w-full table-auto">
                      <thead className="border-b border-cyan-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => handleDetailSort('item_name')} className="inline-flex cursor-pointer items-center gap-1">
                              Product <span>{getDetailSortIndicator('item_name')}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => handleDetailSort('stocks')} className="inline-flex cursor-pointer items-center gap-1">
                              Stocks <span>{getDetailSortIndicator('stocks')}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => handleDetailSort('solds')} className="inline-flex cursor-pointer items-center gap-1">
                              Solds <span>{getDetailSortIndicator('solds')}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => handleDetailSort('leftovers')} className="inline-flex cursor-pointer items-center gap-1">
                              Leftovers <span>{getDetailSortIndicator('leftovers')}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => handleDetailSort('is_ordered')} className="inline-flex cursor-pointer items-center gap-1">
                              Ordered <span>{getDetailSortIndicator('is_ordered')}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => handleDetailSort('is_free')} className="inline-flex cursor-pointer items-center gap-1">
                              Free <span>{getDetailSortIndicator('is_free')}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => handleDetailSort('total_cost')} className="inline-flex cursor-pointer items-center gap-1">
                              Total Cost <span>{getDetailSortIndicator('total_cost')}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => handleDetailSort('total_revenue')} className="inline-flex cursor-pointer items-center gap-1">
                              Total Revenue <span>{getDetailSortIndicator('total_revenue')}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => handleDetailSort('total_loss')} className="inline-flex cursor-pointer items-center gap-1">
                              Total Loss <span>{getDetailSortIndicator('total_loss')}</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => handleDetailSort('net_income')} className="inline-flex cursor-pointer items-center gap-1">
                              Net Income <span>{getDetailSortIndicator('net_income')}</span>
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyan-50 bg-white/80">
                        {detailRecords.map((detail, index) => (
                          <tr key={`${detail.item_name}-${index}`}>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{detail.item_name}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{detail.stocks}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{detail.solds}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{detail.leftovers ?? '-'}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                              <span
                                title={detail.is_ordered ? 'Ordered' : 'Not Ordered'}
                                aria-label={detail.is_ordered ? 'Ordered' : 'Not Ordered'}
                                className={`inline-flex ${detail.is_ordered ? 'text-emerald-600' : 'text-rose-600'}`}
                              >
                                {detail.is_ordered ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                              <span
                                title={detail.is_free ? 'Free' : 'Paid'}
                                aria-label={detail.is_free ? 'Free' : 'Paid'}
                                className={`inline-flex ${detail.is_free ? 'text-emerald-600' : 'text-rose-600'}`}
                              >
                                {detail.is_free ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900"><span className={detailSensorClass}>{formatCurrency(detail.total_cost)}</span></td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900"><span className={detailSensorClass}>{formatCurrency(detail.total_revenue)}</span></td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900"><span className={detailSensorClass}>{formatCurrency(detail.total_loss)}</span></td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                              <span
                                className={`inline-flex items-center gap-1.5 font-medium ${
                                  detail.net_income > 0 ? 'text-emerald-700' : detail.net_income < 0 ? 'text-rose-700' : 'text-slate-700'
                                }`}
                                title={detail.net_income > 0 ? 'Profit' : detail.net_income < 0 ? 'Loss' : 'Break Even'}
                                aria-label={detail.net_income > 0 ? 'Profit' : detail.net_income < 0 ? 'Loss' : 'Break Even'}
                              >
                                {detail.net_income > 0 ? <TrendingUp className="h-4 w-4" /> : detail.net_income < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
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
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-[min(96vw,1040px)] max-w-none overflow-y-auto rounded-2xl border border-cyan-100 bg-white/95 p-5 shadow-2xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Add Office Sales</h2>
                <p className="mt-1 text-sm text-slate-500">Create a new office sales record with items details.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSensorOn((prev) => !prev)}
                  title={isAddSensorOn ? 'Tampilkan nilai finansial' : 'Sembunyikan nilai finansial'}
                  aria-label={isAddSensorOn ? 'Tampilkan nilai finansial' : 'Sembunyikan nilai finansial'}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    isAddSensorOn
                      ? 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      : 'border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                  }`}
                >
                  {isAddSensorOn ? <EyeOff size={16} /> : <Eye size={16} />}
                  {isAddSensorOn ? 'Sensor: On' : 'Sensor: Off'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100"
                  aria-label="Close modal"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Sales Date</label>
                  <input
                    type="date"
                    value={addFormData.sales_date}
                    onChange={(e) => handleAddSalesDateChange(e.target.value)}
                    className="w-full rounded-md border cursor-pointer border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Selling Location</label>
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Stocks</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{addSummaryTotals.totalStocks}</p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Solds</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{addSummaryTotals.totalSolds}</p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Leftovers</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{addSummaryTotals.totalLeftovers}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Cost</p>
                  <p className="mt-1 text-sm font-medium text-slate-900"><span className={addSensorClass}>{formatCurrency(addSummaryTotals.totalCost)}</span></p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Revenue</p>
                  <p className="mt-1 text-sm font-medium text-slate-900"><span className={addSensorClass}>{formatCurrency(addSummaryTotals.totalRevenue)}</span></p>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Loss</p>
                  <p className="mt-1 text-sm font-medium text-slate-900"><span className={addSensorClass}>{formatCurrency(addSummaryTotals.totalLoss)}</span></p>
                </div>
                <div
                  className={`rounded-xl border p-4 shadow-sm ${
                    addSummaryTotals.netIncome > 0
                      ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50'
                      : addSummaryTotals.netIncome < 0
                        ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50'
                        : 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Income</p>
                  <p className={`mt-2 text-sm font-bold ${addSummaryTotals.netIncome > 0 ? 'text-emerald-700' : addSummaryTotals.netIncome < 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                    <span className={addSensorClass}>{formatCurrency(addSummaryTotals.netIncome)}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Items</h3>
                    <p className="mt-1 text-sm text-slate-500">Only active item mappings from Office Pricing for selected location are shown.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 transition-colors hover:bg-cyan-100"
                  >
                    <Plus size={16} />
                    Add Row
                  </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-cyan-100">
                  {addFormItems.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">No items added yet. Click Add Row to add items.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="modern-table w-full min-w-[1660px]">
                        <thead className="border-b border-cyan-100">
                          <tr>
                            <th className="w-[360px] min-w-[360px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Stocks</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Solds</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Leftovers</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Ordered</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Free</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Cost</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Revenue</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Loss</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Net Income</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cyan-50 bg-white/80">
                          {paginatedAddFormItems.map((item) => {
                            const computed = getAddItemComputedValues(item);

                            return (
                              <tr key={item.id}>
                                <td className="w-[360px] min-w-[360px] px-4 py-4 text-sm text-slate-900">
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
                                    placeholder="Select or search product"
                                    formatOptionLabel={(option) => (
                                      <span>{renderHighlightedLabel(option.label, productSearchKeyword[item.id] ?? '')}</span>
                                    )}
                                    noOptionsMessage={() => 'Product not found'}
                                    classNames={getReactSelectClassNames(false, false)}
                                    styles={{
                                      menuPortal: (base) => ({
                                        ...base,
                                        zIndex: 80,
                                      }),
                                    }}
                                  />
                                </td>
                                <td className="px-4 py-4 text-sm text-slate-900">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={item.stocks === 0 ? '' : item.stocks}
                                    onChange={(e) => handleItemChange(item.id, 'stocks', parseNumberInput(e.target.value))}
                                    placeholder="0"
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                  />
                                </td>
                                <td className="px-4 py-4 text-sm text-slate-900">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={item.solds === 0 ? '' : item.solds}
                                    onChange={(e) => handleItemChange(item.id, 'solds', parseNumberInput(e.target.value))}
                                    placeholder="0"
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                  />
                                </td>
                                <td className="px-4 py-4 text-sm text-slate-900">
                                  <input
                                    type="number"
                                    value={item.leftovers}
                                    disabled
                                    className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600"
                                  />
                                </td>
                                <td className="px-4 py-4 text-sm text-slate-900">
                                  <button
                                    type="button"
                                    onClick={() => handleItemChange(item.id, 'is_ordered', !item.is_ordered)}
                                    className={`inline-flex h-7 w-12 items-center cursor-pointer rounded-full p-1 transition ${
                                      item.is_ordered ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span
                                      className={`h-5 w-5 rounded-full bg-white transition ${
                                        item.is_ordered ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </td>
                                <td className="px-4 py-4 text-sm text-slate-900">
                                  <button
                                    type="button"
                                    onClick={() => handleItemChange(item.id, 'is_free', !item.is_free)}
                                    className={`inline-flex h-7 w-12 items-center cursor-pointer rounded-full p-1 transition ${
                                      item.is_free ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span
                                      className={`h-5 w-5 rounded-full bg-white transition ${
                                        item.is_free ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </td>
                                <td className="px-4 py-4 text-sm text-slate-900">
                                  <input
                                    type="text"
                                    disabled
                                    value={formatCurrency(computed.totalCost)}
                                    className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600"
                                    style={isAddSensorOn ? { filter: 'blur(4px)' } : undefined}
                                  />
                                </td>
                                <td className="px-4 py-4 text-sm text-slate-900">
                                  <input
                                    type="text"
                                    disabled
                                    value={formatCurrency(computed.totalRevenue)}
                                    className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600"
                                    style={isAddSensorOn ? { filter: 'blur(4px)' } : undefined}
                                  />
                                </td>
                                <td className="px-4 py-4 text-sm text-slate-900">
                                  <input
                                    type="text"
                                    disabled
                                    value={formatCurrency(computed.totalLoss)}
                                    className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600"
                                    style={isAddSensorOn ? { filter: 'blur(4px)' } : undefined}
                                  />
                                </td>
                                <td className="px-4 py-4 text-sm text-slate-900">
                                  <input
                                    type="text"
                                    disabled
                                    value={formatCurrency(computed.netIncome)}
                                    className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600"
                                    style={isAddSensorOn ? { filter: 'blur(4px)' } : undefined}
                                  />
                                </td>
                                <td className="px-4 py-4 text-sm text-slate-900">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRow(item.id)}
                                    className="inline-flex items-center justify-center cursor-pointer rounded p-1 text-rose-600 transition-colors hover:bg-rose-50"
                                    title="Delete row"
                                    aria-label="Delete row"
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

              <div className="flex gap-3 border-t border-slate-200 pt-6">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAddForm}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Sales
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-[min(96vw,1040px)] max-w-none overflow-y-auto rounded-2xl border border-cyan-100 bg-white/95 p-5 shadow-2xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Edit Office Sales</h2>
                <p className="mt-1 text-sm text-slate-500">Update existing office sales data and item details.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditSensorOn((prev) => !prev)}
                  title={isEditSensorOn ? 'Tampilkan nilai finansial' : 'Sembunyikan nilai finansial'}
                  aria-label={isEditSensorOn ? 'Tampilkan nilai finansial' : 'Sembunyikan nilai finansial'}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    isEditSensorOn
                      ? 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      : 'border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                  }`}
                >
                  {isEditSensorOn ? <EyeOff size={16} /> : <Eye size={16} />}
                  {isEditSensorOn ? 'Sensor: On' : 'Sensor: Off'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100"
                  aria-label="Close edit modal"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isEditLoading ? (
              <div className="p-10 text-center text-slate-500">Loading sales details...</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Sales Date</label>
                    <input
                      type="date"
                      value={editFormData.sales_date}
                      onChange={(e) => handleEditSalesDateChange(e.target.value)}
                      className="w-full rounded-md border cursor-pointer border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Selling Location</label>
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Stocks</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{editSummaryTotals.totalStocks}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Solds</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{editSummaryTotals.totalSolds}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Leftovers</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{editSummaryTotals.totalLeftovers}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Cost</p>
                    <p className="mt-1 text-sm font-medium text-slate-900"><span className={editSensorClass}>{formatCurrency(editSummaryTotals.totalCost)}</span></p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Revenue</p>
                    <p className="mt-1 text-sm font-medium text-slate-900"><span className={editSensorClass}>{formatCurrency(editSummaryTotals.totalRevenue)}</span></p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Loss</p>
                    <p className="mt-1 text-sm font-medium text-slate-900"><span className={editSensorClass}>{formatCurrency(editSummaryTotals.totalLoss)}</span></p>
                  </div>
                  <div
                    className={`rounded-xl border p-4 shadow-sm ${
                      editSummaryTotals.netIncome > 0
                        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50'
                        : editSummaryTotals.netIncome < 0
                          ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50'
                          : 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100'
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Income</p>
                    <p className={`mt-2 text-sm font-bold ${editSummaryTotals.netIncome > 0 ? 'text-emerald-700' : editSummaryTotals.netIncome < 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                      <span className={editSensorClass}>{formatCurrency(editSummaryTotals.netIncome)}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Items</h3>
                      <p className="mt-1 text-sm text-slate-500">Edit mapped items and quantity values for this office sales record.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleEditRow}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 transition-colors hover:bg-cyan-100"
                    >
                      <Plus size={16} />
                      Add Row
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-cyan-100">
                    {editFormItems.length === 0 ? (
                      <div className="p-10 text-center text-slate-500">No items available. Click Add Row to add items.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="modern-table w-full min-w-[1660px]">
                          <thead className="border-b border-cyan-100">
                            <tr>
                              <th className="w-[360px] min-w-[360px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Product</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Stocks</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Solds</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Leftovers</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Ordered</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Free</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Cost</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Revenue</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Loss</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Net Income</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cyan-50 bg-white/80">
                            {paginatedEditFormItems.map((item) => {
                              const computed = getEditItemComputedValues(item);

                              return (
                                <tr key={item.id}>
                                  <td className="w-[360px] min-w-[360px] px-4 py-4 text-sm text-slate-900">
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
                                      placeholder="Select or search product"
                                      formatOptionLabel={(option) => (
                                        <span>{renderHighlightedLabel(option.label, editProductSearchKeyword[item.id] ?? '')}</span>
                                      )}
                                      noOptionsMessage={() => 'Product not found'}
                                      classNames={getReactSelectClassNames(false, false)}
                                      styles={{
                                        menuPortal: (base) => ({
                                          ...base,
                                          zIndex: 80,
                                        }),
                                      }}
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-900">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={item.stocks === 0 ? '' : item.stocks}
                                      onChange={(e) => handleEditItemChange(item.id, 'stocks', parseNumberInput(e.target.value))}
                                      placeholder="0"
                                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-900">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={item.solds === 0 ? '' : item.solds}
                                      onChange={(e) => handleEditItemChange(item.id, 'solds', parseNumberInput(e.target.value))}
                                      placeholder="0"
                                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-900">
                                    <input
                                      type="number"
                                      value={item.leftovers}
                                      disabled
                                      className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600"
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-900">
                                    <button
                                      type="button"
                                      onClick={() => handleEditItemChange(item.id, 'is_ordered', !item.is_ordered)}
                                      className={`inline-flex h-7 w-12 items-center cursor-pointer rounded-full p-1 transition ${
                                        item.is_ordered ? 'bg-emerald-500' : 'bg-slate-300'
                                      }`}
                                    >
                                      <span
                                        className={`h-5 w-5 rounded-full bg-white transition ${
                                          item.is_ordered ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-900">
                                    <button
                                      type="button"
                                      onClick={() => handleEditItemChange(item.id, 'is_free', !item.is_free)}
                                      className={`inline-flex h-7 w-12 items-center cursor-pointer rounded-full p-1 transition ${
                                        item.is_free ? 'bg-emerald-500' : 'bg-slate-300'
                                      }`}
                                    >
                                      <span
                                        className={`h-5 w-5 rounded-full bg-white transition ${
                                          item.is_free ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-900">
                                    <input
                                      type="text"
                                      disabled
                                      value={formatCurrency(computed.totalCost)}
                                      className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600"
                                      style={isEditSensorOn ? { filter: 'blur(4px)' } : undefined}
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-900">
                                    <input
                                      type="text"
                                      disabled
                                      value={formatCurrency(computed.totalRevenue)}
                                      className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600"
                                      style={isEditSensorOn ? { filter: 'blur(4px)' } : undefined}
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-900">
                                    <input
                                      type="text"
                                      disabled
                                      value={formatCurrency(computed.totalLoss)}
                                      className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600"
                                      style={isEditSensorOn ? { filter: 'blur(4px)' } : undefined}
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-900">
                                    <input
                                      type="text"
                                      disabled
                                      value={formatCurrency(computed.netIncome)}
                                      className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600"
                                      style={isEditSensorOn ? { filter: 'blur(4px)' } : undefined}
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-900">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveEditRow(item.id)}
                                      className="inline-flex items-center justify-center cursor-pointer rounded p-1 text-rose-600 transition-colors hover:bg-rose-50"
                                      title="Delete row"
                                      aria-label="Delete row"
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

                <div className="flex gap-3 border-t border-slate-200 pt-6">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitEditForm}
                    disabled={isEditSubmitting}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {isEditSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {reportRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-[min(96vw,760px)] overflow-y-auto rounded-2xl border border-cyan-100 bg-white/95 p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Report Sales</h2>
                <p className="mt-1 text-sm text-slate-500">Preview of the sales receipt for office sales data.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseReportModal}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100"
                aria-label="Close sales report modal"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isReportDetailLoading || isReportDetailFetching ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Memuat data struk...</div>
            ) : (
              <div className="space-y-4">
                <div id="office-sales-receipt-content" className="rounded-xl border border-slate-300 bg-white p-4 text-slate-900 sm:p-6">
                  <div className="border-b border-dashed border-slate-300 pb-3">
                    <h3 className="text-center text-lg font-bold">Sales - {formatReceiptDateTitle(reportRecord.sales_date)}</h3>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[620px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-300">
                          <th className="px-2 py-2 text-left font-semibold">Stok</th>
                          <th className="px-2 py-2 text-left font-semibold">Produk</th>
                          <th className="px-2 py-2 text-left font-semibold">Terjual</th>
                          <th className="px-2 py-2 text-left font-semibold">Perhitungan</th>
                          <th className="px-2 py-2 text-right font-semibold">Total Harga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportReceiptItems.map((item) => {
                          const leftovers = item.leftovers ?? 0;
                          const leftoverText = leftovers > 0 ? `(sisa ${leftovers})` : '(habis)';
                          const uniqueBasePrices = Array.from(new Set(item.item_base_prices));
                          const remarks = uniqueBasePrices.length === 1
                            ? `${item.solds} x ${new Intl.NumberFormat('id-ID').format(uniqueBasePrices[0] ?? 0)}`
                            : `${item.solds} x campuran`;

                          return (
                            <tr key={item.id} className="border-b border-slate-100">
                              <td className="px-2 py-2">{item.stocks}</td>
                              <td className="px-2 py-2">{item.item_name}</td>
                              <td className="px-2 py-2">{leftoverText}</td>
                              <td className="px-2 py-2">{remarks}</td>
                              <td className="px-2 py-2 text-right">{formatCurrency(item.total_cost)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 border-t border-dashed border-slate-300 pt-3">
                    <div className="flex items-center justify-between text-base font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(reportRecord.total_cost)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex">
                  <button
                    type="button"
                    onClick={() => {
                      void handleDownloadReceipt();
                    }}
                    className="cursor-pointer inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
                  >
                    <Download className="h-4 w-4" />
                    Download PNG
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesOffice;
