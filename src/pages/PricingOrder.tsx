import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, EyeOff, Pencil, Plus, Send, X } from 'lucide-react';
import Select, { type InputActionMeta, type SingleValue } from 'react-select';
import Pagination from '../components/Pagination';
import {
  PAGE_SIZE,
  formatCurrency,
  formatDisplayDate,
  formatPriceInput,
  getStatusBadgeClassName,
  isDateRangeInvalid,
  parsePriceInput,
} from '../utils/helper';
import { getReactSelectClassNames, renderHighlightedLabel } from '../utils/officePricing';
import { supabase } from '../utils/supabase';

type SortKey = 'item_name' | 'min_order' | 'selling_price' | 'profit' | 'start_date' | 'end_date' | 'is_active';
type SortDirection = 'asc' | 'desc';

type ItemFilterOption = {
  value: string;
  label: string;
};

type ItemOption = {
  id: number;
  name: string;
  base_price: number;
};

type AddItemSelectOption = {
  value: string;
  label: string;
  basePrice: number;
};

type AddOrderPricingFormData = {
  item_id: string;
  min_order: string;
  selling_price: string;
  profit: string;
  start_date: string;
  end_date: string;
};

type AddOrderPricingFormErrors = {
  item_id?: string;
  min_order?: string;
  selling_price?: string;
  start_date?: string;
  end_date?: string;
};

type EditOrderPricingFormData = {
  end_date: string;
  is_active: boolean | null;
};

type EditOrderPricingFormErrors = {
  end_date?: string;
  is_active?: string;
};

type OrderPricingRecord = {
  id?: number;
  item_id?: number;
  item_name: string;
  min_order: number;
  selling_price: number;
  profit: number;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
};

type OrderPricingQueryResult = {
  records: OrderPricingRecord[];
  totalItems: number;
};

const DEFAULT_ADD_ORDER_PRICING_FORM_DATA: AddOrderPricingFormData = {
  item_id: '',
  min_order: '',
  selling_price: '',
  profit: '',
  start_date: '',
  end_date: '',
};

const DEFAULT_EDIT_ORDER_PRICING_FORM_DATA: EditOrderPricingFormData = {
  end_date: '',
  is_active: true,
};

const formatSignedPriceInput = (value: number) => {
  const absoluteValueFormatted = formatPriceInput(String(Math.abs(value)));
  return value < 0 ? `-${absoluteValueFormatted}` : absoluteValueFormatted;
};

const parseSignedPriceInput = (value: string) => {
  const normalized = value.trim();
  const isNegative = normalized.startsWith('-');
  const numericValue = normalized.replace(/[^\d]/g, '');
  const parsed = Number.parseInt(numericValue || '0', 10);
  return isNegative ? -parsed : parsed;
};

const Order = () => {
  const DEFAULT_ITEM_ID_FILTER = '1';
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('min_order');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedItemIdFilter, setSelectedItemIdFilter] = useState(DEFAULT_ITEM_ID_FILTER);
  const [itemSearchKeyword, setItemSearchKeyword] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState<AddOrderPricingFormData>(
    DEFAULT_ADD_ORDER_PRICING_FORM_DATA,
  );
  const [addItemSearchKeyword, setAddItemSearchKeyword] = useState('');
  const [addFormErrors, setAddFormErrors] = useState<AddOrderPricingFormErrors>({});
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OrderPricingRecord | null>(null);
  const [editFormData, setEditFormData] = useState<EditOrderPricingFormData>(
    DEFAULT_EDIT_ORDER_PRICING_FORM_DATA,
  );
  const [editFormErrors, setEditFormErrors] = useState<EditOrderPricingFormErrors>({});
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isProfitSensorOn, setIsProfitSensorOn] = useState(true);
  const addStartDateRef = useRef<HTMLInputElement | null>(null);
  const addEndDateRef = useRef<HTMLInputElement | null>(null);
  const editEndDateRef = useRef<HTMLInputElement | null>(null);

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

  const { data: orderPricingData, isLoading, isFetching } = useQuery<OrderPricingQueryResult>({
    queryKey: ['order-pricing', currentPage, sortKey, sortDirection, selectedItemIdFilter],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('order_pricing_view')
        .select('id,item_id,item_name,min_order,selling_price,profit,is_active,start_date,end_date', { count: 'exact' })
        .order(sortKey, { ascending: sortDirection === 'asc' });

      if (selectedItemIdFilter) {
        query = query.eq('item_id', Number.parseInt(selectedItemIdFilter, 10));
      }

      const { data, error, count } = await query
        .range(from, to);

      if (error) {
        throw error;
      }

      return {
        records: (data ?? []) as OrderPricingRecord[],
        totalItems: count ?? 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: itemFilterRows } = useQuery<Array<{ item_id: number | null; item_name: string | null }>>({
    queryKey: ['order-pricing-item-filters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_pricing_view')
        .select('item_id,item_name')
        .not('item_id', 'is', null)
        .not('item_name', 'is', null)
        .order('item_name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as Array<{ item_id: number | null; item_name: string | null }>;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: itemOptionsData } = useQuery<ItemOption[]>({
    queryKey: ['order-pricing-add-item-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id,name,base_price')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as ItemOption[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const records = orderPricingData?.records ?? [];
  const totalItems = orderPricingData?.totalItems ?? 0;
  const loading = isLoading || isFetching;
  const profitSensorClass = isProfitSensorOn ? 'select-none blur-sm' : '';
  const itemOptions = itemOptionsData ?? [];

  const itemFilterOptions = useMemo<ItemFilterOption[]>(() => {
    const mapByItemId = new Map<string, ItemFilterOption>();

    (itemFilterRows ?? []).forEach((row) => {
      const itemId = row.item_id;
      const itemName = row.item_name?.trim() ?? '';

      if (itemId === null || !itemName) {
        return;
      }

      const optionValue = String(itemId);
      if (!mapByItemId.has(optionValue)) {
        mapByItemId.set(optionValue, {
          value: optionValue,
          label: itemName,
        });
      }
    });

    return Array.from(mapByItemId.values());
  }, [itemFilterRows]);

  const selectedItemFilterOption = useMemo(
    () => itemFilterOptions.find((option) => option.value === selectedItemIdFilter) ?? null,
    [itemFilterOptions, selectedItemIdFilter],
  );

  const addItemSelectOptions = useMemo<AddItemSelectOption[]>(
    () =>
      itemOptions.map((item) => ({
        value: String(item.id),
        label: item.name,
        basePrice: item.base_price,
      })),
    [itemOptions],
  );

  const selectedAddItemOption = useMemo(
    () => addItemSelectOptions.find((option) => option.value === addFormData.item_id) ?? null,
    [addFormData.item_id, addItemSelectOptions],
  );

  const selectedAddItem = useMemo(
    () => itemOptions.find((item) => item.id === Number.parseInt(addFormData.item_id, 10)),
    [itemOptions, addFormData.item_id],
  );

  const addDateRangeInvalid = isDateRangeInvalid(addFormData.start_date, addFormData.end_date);

  useEffect(() => {
    if (itemFilterOptions.length === 0 || selectedItemIdFilter) {
      return;
    }

    const lemperAyamOption = itemFilterOptions.find((option) => option.label.toLowerCase() === 'lemper ayam');
    setSelectedItemIdFilter(lemperAyamOption?.value ?? DEFAULT_ITEM_ID_FILTER);
  }, [itemFilterOptions, selectedItemIdFilter]);

  const handleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(nextKey);
      setSortDirection('asc');
    }

    setCurrentPage(1);
  };

  const openAddModal = () => {
    setAddFormData(DEFAULT_ADD_ORDER_PRICING_FORM_DATA);
    setAddItemSearchKeyword('');
    setAddFormErrors({});
    setIsAddModalOpen(true);
  };

  const handleAddModalClose = () => {
    if (isAddSubmitting) {
      return;
    }

    setIsAddModalOpen(false);
    setAddFormData(DEFAULT_ADD_ORDER_PRICING_FORM_DATA);
    setAddItemSearchKeyword('');
    setAddFormErrors({});
  };

  const openEditModal = (record: OrderPricingRecord) => {
    setEditingRecord(record);
    setEditFormData({
      end_date: record.end_date ?? '',
      is_active: record.is_active,
    });
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    if (isEditSubmitting) {
      return;
    }

    setIsEditModalOpen(false);
    setEditingRecord(null);
    setEditFormData(DEFAULT_EDIT_ORDER_PRICING_FORM_DATA);
    setEditFormErrors({});
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleItemFilterChange = (selected: SingleValue<ItemFilterOption>) => {
    setSelectedItemIdFilter(selected?.value ?? '');
    setCurrentPage(1);
  };

  const handleItemSearchInputChange = (value: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') setItemSearchKeyword(value);
    if (meta.action === 'set-value' || meta.action === 'menu-close') setItemSearchKeyword('');
    return value;
  };

  const getComputedProfit = (sellingPriceFormatted: string, itemIdValue: string) => {
    const selected = itemOptions.find((item) => item.id === Number.parseInt(itemIdValue, 10));
    const sellingPrice = parsePriceInput(sellingPriceFormatted);
    const basePrice = selected?.base_price ?? 0;
    return formatSignedPriceInput(sellingPrice - basePrice);
  };

  const handleAddItemSelectChange = (selected: SingleValue<AddItemSelectOption>) => {
    const nextItemId = selected?.value ?? '';

    setAddFormData((prev) => {
      const nextSellingPrice = nextItemId ? prev.selling_price : '';

      return {
        ...prev,
        item_id: nextItemId,
        selling_price: nextSellingPrice,
        profit: nextItemId ? getComputedProfit(nextSellingPrice, nextItemId) : '',
      };
    });

    if (addFormErrors.item_id) {
      setAddFormErrors((prev) => ({ ...prev, item_id: undefined }));
    }
  };

  const handleAddItemSearchInputChange = (value: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') setAddItemSearchKeyword(value);
    if (meta.action === 'set-value' || meta.action === 'menu-close') setAddItemSearchKeyword('');
    return value;
  };

  const handleAddMinOrderChange = (value: string) => {
    const numericValue = value.replace(/[^\d]/g, '');

    setAddFormData((prev) => ({
      ...prev,
      min_order: numericValue,
    }));

    if (addFormErrors.min_order) {
      setAddFormErrors((prev) => ({ ...prev, min_order: undefined }));
    }
  };

  const handleAddSellingPriceChange = (value: string) => {
    const formatted = formatPriceInput(value);

    setAddFormData((prev) => ({
      ...prev,
      selling_price: formatted,
      profit: getComputedProfit(formatted, prev.item_id),
    }));

    if (addFormErrors.selling_price) {
      setAddFormErrors((prev) => ({ ...prev, selling_price: undefined }));
    }
  };

  const handleAddDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setAddFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name in addFormErrors) {
      setAddFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleEditDateChange = (value: string) => {
    setEditFormData((prev) => ({
      ...prev,
      end_date: value,
    }));

    if (editFormErrors.end_date) {
      setEditFormErrors((prev) => ({ ...prev, end_date: undefined }));
    }
  };

  const handleEditStatusToggle = () => {
    setEditFormData((prev) => ({
      ...prev,
      is_active: !(prev.is_active ?? false),
    }));

    if (editFormErrors.is_active) {
      setEditFormErrors((prev) => ({ ...prev, is_active: undefined }));
    }
  };

  const validateAddForm = (formData: AddOrderPricingFormData): AddOrderPricingFormErrors => {
    const nextErrors: AddOrderPricingFormErrors = {};

    if (!formData.item_id) {
      nextErrors.item_id = 'Item is required.';
    }

    if (!formData.min_order.trim()) {
      nextErrors.min_order = 'Min Order is required.';
    } else if (Number.parseInt(formData.min_order, 10) < 0) {
      nextErrors.min_order = 'Min Order must be 0 or greater.';
    }

    if (!formData.selling_price.trim()) {
      nextErrors.selling_price = 'Selling Price is required.';
    }

    if (!formData.start_date) {
      nextErrors.start_date = 'Start Date is required.';
    }

    if (isDateRangeInvalid(formData.start_date, formData.end_date)) {
      nextErrors.end_date = 'End Date must be later than Start Date.';
    }

    return nextErrors;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAddSubmitting) {
      return;
    }

    const nextErrors = validateAddForm(addFormData);
    if (Object.keys(nextErrors).length > 0) {
      setAddFormErrors(nextErrors);
      return;
    }

    setIsAddSubmitting(true);

    try {
      const nextItemId = Number.parseInt(addFormData.item_id, 10);
      const nextMinOrder = Number.parseInt(addFormData.min_order, 10);

      const { data: existingActiveRecord, error: existingCheckError } = await supabase
        .from('order_pricing')
        .select('id')
        .eq('item_id', nextItemId)
        .eq('min_order', nextMinOrder)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (existingCheckError) {
        console.error('Error validating active min order uniqueness:', existingCheckError);
        alert(`Error validating active min order uniqueness: ${existingCheckError.message}`);
        return;
      }

      if (existingActiveRecord) {
        setAddFormErrors((prev) => ({
          ...prev,
          min_order: 'Min Order for selected item already exists with Active status.',
        }));
        return;
      }

      const { error } = await supabase
        .from('order_pricing')
        .insert([
          {
            item_id: nextItemId,
            min_order: nextMinOrder,
            selling_price: parsePriceInput(addFormData.selling_price),
            profit: parseSignedPriceInput(addFormData.profit),
            is_active: true,
            start_date: addFormData.start_date,
            end_date: addFormData.end_date.trim() ? addFormData.end_date : null,
          },
        ])
        .select();

      if (error) {
        console.error('Error adding order pricing:', error);
        alert(`Error adding order pricing: ${error.message}`);
        return;
      }

      setIsAddModalOpen(false);
      setAddFormData(DEFAULT_ADD_ORDER_PRICING_FORM_DATA);
      setAddItemSearchKeyword('');
      setAddFormErrors({});

      if (currentPage !== 1) {
        setCurrentPage(1);
      }

      await queryClient.invalidateQueries({
        queryKey: ['order-pricing'],
        exact: false,
        refetchType: 'all',
      });
    } catch (error) {
      console.error('Error adding order pricing:', error);
      alert('Error adding order pricing');
    } finally {
      setIsAddSubmitting(false);
    }
  };

  const validateEditForm = (
    formData: EditOrderPricingFormData,
    record: OrderPricingRecord | null,
  ): EditOrderPricingFormErrors => {
    const nextErrors: EditOrderPricingFormErrors = {};

    if (!formData.end_date) {
      nextErrors.end_date = 'End Date is required.';
    }

    if (typeof formData.is_active !== 'boolean') {
      nextErrors.is_active = 'Status is required.';
    }

    if (record && formData.end_date && formData.end_date <= record.start_date) {
      nextErrors.end_date = 'End Date must be later than Start Date.';
    }

    return nextErrors;
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditSubmitting || !editingRecord?.id) {
      return;
    }

    const nextErrors = validateEditForm(editFormData, editingRecord);
    if (Object.keys(nextErrors).length > 0) {
      setEditFormErrors(nextErrors);
      return;
    }

    setIsEditSubmitting(true);

    try {
      const { error } = await supabase
        .from('order_pricing')
        .update({
          end_date: editFormData.end_date,
          is_active: editFormData.is_active,
        })
        .eq('id', editingRecord.id)
        .select();

      if (error) {
        console.error('Error updating order pricing:', error);
        alert(`Error updating order pricing: ${error.message}`);
        return;
      }

      setIsEditModalOpen(false);
      setEditingRecord(null);
      setEditFormData(DEFAULT_EDIT_ORDER_PRICING_FORM_DATA);
      setEditFormErrors({});

      await queryClient.invalidateQueries({
        queryKey: ['order-pricing'],
        exact: false,
        refetchType: 'all',
      });
    } catch (error) {
      console.error('Error updating order pricing:', error);
      alert('Error updating order pricing');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  return (
    <div className="page-enter space-y-6">
      <div className="page-header">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="inline-flex list-none flex-wrap items-center gap-2 p-0">
            <li>Home</li>
            <li>/</li>
            <li className="font-semibold text-slate-900">Pricing</li>
            <li>/</li>
            <li className="font-semibold uppercase tracking-[0.08em] text-cyan-800">Order</li>
          </ol>
        </nav>
        <h1 className="page-title">Order Pricing</h1>
        <p className="page-subtitle">Manage order pricing for customer transactions.</p>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl border border-cyan-100">
        <div className="flex flex-col gap-3 border-b border-cyan-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="w-full max-w-xs">
            <Select<ItemFilterOption, false>
              options={itemFilterOptions}
              value={selectedItemFilterOption}
              onChange={handleItemFilterChange}
              onInputChange={handleItemSearchInputChange}
              isSearchable
              isClearable
              placeholder="Filter item..."
              formatOptionLabel={(option) => (
                <span>{renderHighlightedLabel(option.label, itemSearchKeyword)}</span>
              )}
              noOptionsMessage={() => 'Item not found'}
              classNames={getReactSelectClassNames(false, false)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsProfitSensorOn((prev) => !prev)}
              title={isProfitSensorOn ? 'Tampilkan nilai profit' : 'Sembunyikan nilai profit'}
              aria-label={isProfitSensorOn ? 'Tampilkan nilai profit' : 'Sembunyikan nilai profit'}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                isProfitSensorOn
                  ? 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  : 'border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
              }`}
            >
              {isProfitSensorOn ? <EyeOff size={16} /> : <Eye size={16} />}
              {isProfitSensorOn ? 'Sensor: On' : 'Sensor: Off'}
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="modern-primary flex cursor-pointer items-center justify-center gap-2 px-4 py-2 font-medium"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading order pricing...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="modern-table w-full min-w-[900px]">
              <thead className="border-b border-cyan-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button
                      type="button"
                      onClick={() => handleSort('item_name')}
                      className="inline-flex cursor-pointer items-center gap-1"
                    >
                      Item <span>{getSortIndicator('item_name')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button
                      type="button"
                      onClick={() => handleSort('min_order')}
                      className="inline-flex cursor-pointer items-center gap-1"
                    >
                      Min Order <span>{getSortIndicator('min_order')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button
                      type="button"
                      onClick={() => handleSort('selling_price')}
                      className="inline-flex cursor-pointer items-center gap-1"
                    >
                      Selling Price <span>{getSortIndicator('selling_price')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button
                      type="button"
                      onClick={() => handleSort('profit')}
                      className="inline-flex cursor-pointer items-center gap-1"
                    >
                      Profit <span>{getSortIndicator('profit')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button
                      type="button"
                      onClick={() => handleSort('start_date')}
                      className="inline-flex cursor-pointer items-center gap-1"
                    >
                      Start Date <span>{getSortIndicator('start_date')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button
                      type="button"
                      onClick={() => handleSort('end_date')}
                      className="inline-flex cursor-pointer items-center gap-1"
                    >
                      End Date <span>{getSortIndicator('end_date')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button
                      type="button"
                      onClick={() => handleSort('is_active')}
                      className="inline-flex cursor-pointer items-center gap-1"
                    >
                      Status <span>{getSortIndicator('is_active')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-50 bg-white/80">
                {records.map((record, index) => (
                  <tr key={record.id ?? `${record.item_name}-${record.start_date}-${record.end_date ?? 'null'}-${index}`}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.item_name ?? '-'}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.min_order}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      {formatCurrency(record.selling_price)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      <span className={profitSensorClass}>{formatCurrency(record.profit)}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{formatDisplayDate(record.start_date)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{formatDisplayDate(record.end_date)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      <span
                        className={getStatusBadgeClassName(
                          record.is_active,
                          'bg-green-100 text-green-800',
                          'bg-red-100 text-red-800',
                        )}
                      >
                        {record.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      <button
                        type="button"
                        onClick={() => openEditModal(record)}
                        title="Edit order pricing"
                        aria-label={`Edit order pricing for ${record.item_name ?? 'item'}`}
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="p-10 text-center text-slate-500">No order pricing found.</div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-cyan-100 bg-white/95 p-5 shadow-2xl sm:mx-4 sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Add Order Pricing</h2>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Item</label>
                <Select<AddItemSelectOption, false>
                  options={addItemSelectOptions}
                  value={selectedAddItemOption}
                  onChange={handleAddItemSelectChange}
                  onInputChange={handleAddItemSearchInputChange}
                  isSearchable
                  isClearable
                  placeholder="Select or search item"
                  formatOptionLabel={(option) => (
                    <span>{renderHighlightedLabel(option.label, addItemSearchKeyword)}</span>
                  )}
                  noOptionsMessage={() => 'Item not found'}
                  className={addFormErrors.item_id ? 'animate-pulse' : ''}
                  classNames={getReactSelectClassNames(Boolean(addFormErrors.item_id), false)}
                />
                {addFormErrors.item_id && (
                  <p className="mt-1 animate-pulse text-sm text-red-600">{addFormErrors.item_id}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Min Order</label>
                <input
                  type="text"
                  name="min_order"
                  autoComplete="off"
                  value={addFormData.min_order}
                  onChange={(e) => handleAddMinOrderChange(e.target.value)}
                  placeholder="0"
                  className={`w-full rounded-md border px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    addFormErrors.min_order
                      ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                      : 'border-slate-300 focus:ring-blue-500'
                  }`}
                />
                {addFormErrors.min_order && (
                  <p className="mt-1 animate-pulse text-sm text-red-600">{addFormErrors.min_order}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Selling Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 transform font-medium text-slate-500">Rp</span>
                  <input
                    type="text"
                    name="selling_price"
                    autoComplete="off"
                    value={addFormData.selling_price}
                    onChange={(e) => handleAddSellingPriceChange(e.target.value)}
                    disabled={!addFormData.item_id}
                    className={`w-full rounded-md border py-2 pl-10 pr-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                      addFormErrors.selling_price
                        ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                        : 'border-slate-300 focus:ring-blue-500'
                    } ${!addFormData.item_id ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                    placeholder="0"
                  />
                </div>
                {addFormErrors.selling_price && (
                  <p className="mt-1 animate-pulse text-sm text-red-600">{addFormErrors.selling_price}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Profit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 transform font-medium text-slate-500">Rp</span>
                  <input
                    type="text"
                    name="profit"
                    autoComplete="off"
                    value={addFormData.profit}
                    disabled
                    className="w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 py-2 pl-10 pr-3 text-slate-500"
                    placeholder="0"
                  />
                </div>
                {selectedAddItem && (
                  <p className="mt-1 text-xs text-slate-500">
                    Base Price: Rp {selectedAddItem.base_price.toLocaleString('id-ID')}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
                <div className="relative" onClick={() => openDatePicker(addStartDateRef.current)}>
                  <input
                    type="text"
                    value={addFormData.start_date ? formatDisplayDate(addFormData.start_date) : ''}
                    readOnly
                    placeholder="dd mmmm yyyy"
                    className={`w-full cursor-pointer rounded-md border bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                      addFormErrors.start_date
                        ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                  <input
                    ref={addStartDateRef}
                    type="date"
                    name="start_date"
                    autoComplete="off"
                    value={addFormData.start_date}
                    onChange={handleAddDateChange}
                    max={addFormData.end_date || undefined}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
                {addFormErrors.start_date && (
                  <p className="mt-1 animate-pulse text-sm text-red-600">{addFormErrors.start_date}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">End Date (Optional)</label>
                <div className="relative" onClick={() => openDatePicker(addEndDateRef.current)}>
                  <input
                    type="text"
                    value={addFormData.end_date ? formatDisplayDate(addFormData.end_date) : ''}
                    readOnly
                    placeholder="dd mmmm yyyy"
                    className={`w-full cursor-pointer rounded-md border bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                      addFormErrors.end_date
                        ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                  <input
                    ref={addEndDateRef}
                    type="date"
                    name="end_date"
                    autoComplete="off"
                    value={addFormData.end_date}
                    onChange={handleAddDateChange}
                    min={addFormData.start_date || undefined}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
                {addFormErrors.end_date && (
                  <p className="mt-1 animate-pulse text-sm text-red-600">{addFormErrors.end_date}</p>
                )}
              </div>

              {addDateRangeInvalid && (
                <p className="text-sm text-red-600">End Date must be later than Start Date.</p>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleAddModalClose}
                  disabled={isAddSubmitting}
                  className="flex cursor-pointer items-center gap-2 rounded-md bg-slate-200 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddSubmitting || addDateRangeInvalid}
                  className="flex cursor-pointer items-center gap-2 rounded-md bg-cyan-600 px-4 py-2 font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-300"
                >
                  <Send size={16} />
                  {isAddSubmitting ? 'Submiting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-cyan-100 bg-white/95 p-5 shadow-2xl sm:mx-4 sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Edit Order Pricing</h2>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Item</label>
                <input
                  type="text"
                  value={editingRecord.item_name ?? '-'}
                  disabled
                  className="w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
                <input
                  type="text"
                  value={formatDisplayDate(editingRecord.start_date)}
                  disabled
                  className="w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">End Date</label>
                <div className="relative" onClick={() => openDatePicker(editEndDateRef.current)}>
                  <input
                    type="text"
                    value={editFormData.end_date ? formatDisplayDate(editFormData.end_date) : ''}
                    readOnly
                    placeholder="dd mmmm yyyy"
                    className={`w-full cursor-pointer rounded-md border bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                      editFormErrors.end_date
                        ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                  <input
                    ref={editEndDateRef}
                    type="date"
                    name="end_date"
                    autoComplete="off"
                    value={editFormData.end_date}
                    onChange={(e) => handleEditDateChange(e.target.value)}
                    min={editingRecord.start_date || undefined}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
                {editFormErrors.end_date && (
                  <p className="mt-1 animate-pulse text-sm text-red-600">{editFormErrors.end_date}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                <button
                  type="button"
                  onClick={handleEditStatusToggle}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 transition-colors ${
                    editFormErrors.is_active
                      ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                  role="switch"
                  aria-checked={Boolean(editFormData.is_active)}
                >
                  <span className="text-sm font-medium text-slate-700">
                    {editFormData.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      editFormData.is_active ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        editFormData.is_active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </button>
                {editFormErrors.is_active && (
                  <p className="mt-1 animate-pulse text-sm text-red-600">{editFormErrors.is_active}</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleEditModalClose}
                  disabled={isEditSubmitting}
                  className="flex cursor-pointer items-center gap-2 rounded-md bg-slate-200 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="flex cursor-pointer items-center gap-2 rounded-md bg-cyan-600 px-4 py-2 font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-300"
                >
                  <Check size={16} />
                  {isEditSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Order;
