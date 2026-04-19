import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, X } from 'lucide-react';
import Select, { type InputActionMeta, type SingleValue } from 'react-select';
import Pagination from '../components/Pagination';
import { supabase } from '../utils/supabase';
import { SELLING_LOCATIONS } from '../constants/sellingLocations';
import {
  getReactSelectClassNames,
  renderHighlightedLabel,
  validateOfficePricingAddForm,
  validateOfficePricingEditForm,
} from '../utils/officePricing';
import {
  DEFAULT_OFFICE_PRICING_FORM_DATA,
  type ItemOption,
  type ItemSelectOption,
  type LocationSelectOption,
  type ModalMode,
  type OfficePricingFormData,
  type OfficePricingFormErrors,
  type OfficePricingItem,
  type OfficePricingQueryResult,
} from '../types/officePricing';
import {
  PAGE_SIZE,
  formatDisplayDate,
  formatPriceInput,
  getNextDateValue,
  isDateRangeInvalid,
  parsePriceInput,
} from '../utils/helper';

type SortKey =
  | 'item_name'
  | 'selling_location'
  | 'selling_price'
  | 'profit'
  | 'start_date'
  | 'end_date'
  | 'is_active';

type SortDirection = 'asc' | 'desc';

const PricingOffice = () => {
  const defaultLocationFilter = SELLING_LOCATIONS[0] ?? '';
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>(defaultLocationFilter);
  const [sortKey, setSortKey] = useState<SortKey>('item_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<OfficePricingFormData>(DEFAULT_OFFICE_PRICING_FORM_DATA);
  const [itemSearchKeyword, setItemSearchKeyword] = useState('');
  const [locationSearchKeyword, setLocationSearchKeyword] = useState('');
  const [errors, setErrors] = useState<OfficePricingFormErrors>({});
  const startDateRef = useRef<HTMLInputElement | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const { data: officePricingQueryData, isLoading: isOfficePricingLoading } = useQuery<OfficePricingQueryResult>({
    queryKey: ['office-pricing', currentPage, selectedLocationFilter],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('office_pricing')
        .select('*,items(name)', { count: 'exact' })
        .order('name', { ascending: true, foreignTable: 'items' })
        .order('id', { ascending: false })
        .range(from, to);

      if (selectedLocationFilter) {
        query = query.eq('selling_location', selectedLocationFilter);
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        records: (data ?? []) as OfficePricingItem[],
        totalItems: count ?? 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: itemOptionsData } = useQuery<ItemOption[]>({
    queryKey: ['item-options'],
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

  const records = officePricingQueryData?.records ?? [];
  const totalItems = officePricingQueryData?.totalItems ?? 0;
  const loading = isOfficePricingLoading;
  const itemOptions = itemOptionsData ?? [];

  const sortedRecords = useMemo(() => {
    const copiedRecords = [...records];

    copiedRecords.sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'item_name': {
          const aValue = a.items?.name ?? '';
          const bValue = b.items?.name ?? '';
          comparison = aValue.localeCompare(bValue, undefined, { sensitivity: 'base' });
          break;
        }
        case 'selling_location': {
          comparison = a.selling_location.localeCompare(b.selling_location, undefined, { sensitivity: 'base' });
          break;
        }
        case 'selling_price': {
          comparison = a.selling_price - b.selling_price;
          break;
        }
        case 'profit': {
          comparison = a.profit - b.profit;
          break;
        }
        case 'start_date': {
          comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
          break;
        }
        case 'end_date': {
          const aValue = a.end_date ? new Date(a.end_date).getTime() : Number.POSITIVE_INFINITY;
          const bValue = b.end_date ? new Date(b.end_date).getTime() : Number.POSITIVE_INFINITY;
          comparison = aValue - bValue;
          break;
        }
        case 'is_active': {
          comparison = Number(a.is_active) - Number(b.is_active);
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return copiedRecords;
  }, [records, sortDirection, sortKey]);

  const itemSelectOptions = useMemo<ItemSelectOption[]>(
    () =>
      itemOptions.map((item) => ({
        value: String(item.id),
        label: item.name,
        basePrice: item.base_price,
      })),
    [itemOptions],
  );

  const selectedItemOption = useMemo(
    () => itemSelectOptions.find((option) => option.value === formData.item_id) ?? null,
    [formData.item_id, itemSelectOptions],
  );

  const sellingLocationOptions = useMemo<LocationSelectOption[]>(
    () => SELLING_LOCATIONS.map((location) => ({ value: location, label: location })),
    [],
  );

  const selectedLocationOption = useMemo(
    () =>
      sellingLocationOptions.find((option) => option.value === formData.selling_location) ?? null,
    [formData.selling_location, sellingLocationOptions],
  );

  const handleLocationFilterChange = (location: string) => {
    setSelectedLocationFilter(location);
    setCurrentPage(1);
  };

  const handleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return '↕';
    }

    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const openAddModal = () => {
    setModalMode('add');
    setEditingId(null);
    setFormData(DEFAULT_OFFICE_PRICING_FORM_DATA);
    setItemSearchKeyword('');
    setLocationSearchKeyword('');
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (record: OfficePricingItem) => {
    setModalMode('edit');
    setEditingId(record.id);
    setFormData({
      item_id: String(record.item_id),
      selling_location: record.selling_location,
      selling_price: formatPriceInput(String(record.selling_price)),
      profit: formatPriceInput(String(record.profit)),
      start_date: record.start_date,
      end_date: record.end_date ?? '',
      is_active: record.is_active,
    });
    setItemSearchKeyword('');
    setLocationSearchKeyword('');
    setErrors({});
    setIsModalOpen(true);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name in errors) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const selectedItem = itemOptions.find((item) => item.id === Number.parseInt(formData.item_id, 10));

  const getComputedProfit = useCallback(
    (sellingPriceFormatted: string, itemIdValue: string) => {
      const selected = itemOptions.find((item) => item.id === Number.parseInt(itemIdValue, 10));
      const sellingPrice = parsePriceInput(sellingPriceFormatted);
      const basePrice = selected?.base_price ?? 0;
      const computed = Math.max(sellingPrice - basePrice, 0);

      return formatPriceInput(String(computed));
    },
    [itemOptions],
  );

  const handleItemSelectChange = (selected: SingleValue<ItemSelectOption>) => {
    const nextItemId = selected?.value ?? '';

    setFormData((prev) => {
      const nextSellingPrice = nextItemId ? prev.selling_price : '';
      return {
        ...prev,
        item_id: nextItemId,
        selling_price: nextSellingPrice,
        profit: nextItemId ? getComputedProfit(nextSellingPrice, nextItemId) : '',
      };
    });

    if (errors.item_id) {
      setErrors((prev) => ({ ...prev, item_id: undefined }));
    }
  };

  const handleSellingPriceChange = (value: string) => {
    const formatted = formatPriceInput(value);

    setFormData((prev) => ({
      ...prev,
      selling_price: formatted,
      profit: getComputedProfit(formatted, prev.item_id),
    }));

    if (errors.selling_price) {
      setErrors((prev) => ({ ...prev, selling_price: undefined }));
    }

  };

  const handleItemSearchInputChange = (value: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') {
      setItemSearchKeyword(value);
    }

    if (meta.action === 'set-value' || meta.action === 'menu-close') {
      setItemSearchKeyword('');
    }

    return value;
  };

  const handleLocationSearchInputChange = (value: string, meta: InputActionMeta) => {
    if (meta.action === 'input-change') {
      setLocationSearchKeyword(value);
    }

    if (meta.action === 'set-value' || meta.action === 'menu-close') {
      setLocationSearchKeyword('');
    }

    return value;
  };

  const handleLocationSelectChange = (selected: SingleValue<LocationSelectOption>) => {
    setFormData((prev) => ({
      ...prev,
      selling_location: selected?.value ?? '',
    }));

    if (errors.selling_location) {
      setErrors((prev) => ({ ...prev, selling_location: undefined }));
    }
  };

  const handleStatusToggle = () => {
    setFormData((prev) => ({
      ...prev,
      is_active: !(prev.is_active ?? false),
    }));

    if (errors.status) {
      setErrors((prev) => ({ ...prev, status: undefined }));
    }
  };

  const dateRangeInvalid = isDateRangeInvalid(formData.start_date, formData.end_date);
  const editDateRangeInvalid =
    modalMode === 'edit' &&
    Boolean(formData.start_date) &&
    Boolean(formData.end_date) &&
    formData.end_date <= formData.start_date;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = modalMode === 'edit' ? validateOfficePricingEditForm(formData) : validateOfficePricingAddForm(formData);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if ((modalMode === 'add' && dateRangeInvalid) || editDateRangeInvalid) {
      alert('Start Date cannot be greater than End Date.');
      return;
    }

    try {
      const { error } =
        modalMode === 'edit'
          ? await supabase
              .from('office_pricing')
              .update({
                end_date: formData.end_date,
                is_active: formData.is_active,
              })
              .eq('id', editingId)
              .select()
          : await supabase
              .from('office_pricing')
              .insert([
                {
                  item_id: Number.parseInt(formData.item_id, 10),
                  selling_location: formData.selling_location,
                  selling_price: parsePriceInput(formData.selling_price),
                  profit: parsePriceInput(formData.profit),
                  start_date: formData.start_date,
                  end_date: formData.end_date || null,
                  is_active: true,
                },
              ])
              .select();

      if (error) {
        console.error(`Error ${modalMode === 'edit' ? 'updating' : 'adding'} office pricing:`, error);
        alert(`Error ${modalMode === 'edit' ? 'updating' : 'adding'} office pricing: ${error.message}`);
        return;
      }

      setIsModalOpen(false);
      setModalMode('add');
      setEditingId(null);
      setFormData(DEFAULT_OFFICE_PRICING_FORM_DATA);
      setItemSearchKeyword('');
      setLocationSearchKeyword('');
      setErrors({});
      await queryClient.invalidateQueries({ queryKey: ['office-pricing'] });

      if (modalMode === 'add' && currentPage !== 1) {
        setCurrentPage(1);
      }
    } catch (error) {
      console.error(`Error ${modalMode === 'edit' ? 'updating' : 'adding'} office pricing:`, error);
      alert(`Error ${modalMode === 'edit' ? 'updating' : 'adding'} office pricing`);
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setModalMode('add');
    setEditingId(null);
    setFormData(DEFAULT_OFFICE_PRICING_FORM_DATA);
    setItemSearchKeyword('');
    setLocationSearchKeyword('');
    setErrors({});
  };

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="page-header w-full">
          <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
            <ol className="inline-flex list-none flex-wrap items-center gap-2 p-0">
              <li>Home</li>
              <li>/</li>
              <li className="font-semibold text-slate-900">Pricing</li>
              <li>/</li>
              <li className="font-semibold uppercase tracking-[0.08em] text-cyan-800">Office</li>
            </ol>
          </nav>
          <h1 className="page-title">Office Pricing</h1>
          <p className="page-subtitle">Manage prices for daily sales in the office.</p>
        </div>
        <button
          onClick={openAddModal}
          className="modern-primary flex w-full cursor-pointer items-center justify-center gap-2 px-4 py-2 font-medium sm:w-auto"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl border border-cyan-100">
        <div className="border-b border-cyan-100 px-4 py-3 sm:px-6">
          <div className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-cyan-50 p-1">
            {SELLING_LOCATIONS.map((location) => {
              const isActive = selectedLocationFilter === location;

              return (
                <button
                  key={location}
                  type="button"
                  onClick={() => handleLocationFilterChange(location)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-white text-cyan-800 shadow-sm ring-1 ring-cyan-200'
                      : 'text-slate-600 hover:bg-white/70 hover:text-cyan-700'
                  }`}
                >
                  {location}
                </button>
              );
            })}
          </div>
        </div>
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading office pricing...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="modern-table w-full min-w-[900px]">
              <thead className="border-b border-cyan-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('item_name')} className="inline-flex cursor-pointer items-center gap-1">
                      Item <span>{getSortIndicator('item_name')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('selling_location')} className="inline-flex cursor-pointer items-center gap-1">
                      Selling Location <span>{getSortIndicator('selling_location')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('selling_price')} className="inline-flex cursor-pointer items-center gap-1">
                      Selling Price <span>{getSortIndicator('selling_price')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('profit')} className="inline-flex cursor-pointer items-center gap-1">
                      Profit <span>{getSortIndicator('profit')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('start_date')} className="inline-flex cursor-pointer items-center gap-1">
                      Start Date <span>{getSortIndicator('start_date')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('end_date')} className="inline-flex cursor-pointer items-center gap-1">
                      End Date <span>{getSortIndicator('end_date')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('is_active')} className="inline-flex cursor-pointer items-center gap-1">
                      Status <span>{getSortIndicator('is_active')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-50 bg-white/80">
                {sortedRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.items?.name ?? '-'}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.selling_location}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      Rp {record.selling_price.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">Rp {record.profit.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{formatDisplayDate(record.start_date)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{formatDisplayDate(record.end_date)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          record.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {record.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      <button
                        type="button"
                        onClick={() => openEditModal(record)}
                        title="Edit office pricing"
                        aria-label={`Edit office pricing for ${record.items?.name ?? 'item'}`}
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
          <div className="p-10 text-center text-slate-500">No office pricing found.</div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-cyan-100 bg-white/95 p-5 shadow-2xl sm:mx-4 sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900">{modalMode === 'edit' ? 'Edit Office Pricing' : 'Add Office Pricing'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Item</label>
                <Select<ItemSelectOption, false>
                  options={itemSelectOptions}
                  value={selectedItemOption}
                  onChange={handleItemSelectChange}
                  onInputChange={handleItemSearchInputChange}
                  isSearchable
                  isClearable
                  isDisabled={modalMode === 'edit'}
                  placeholder="Select or search item"
                  formatOptionLabel={(option) => (
                    <span>{renderHighlightedLabel(option.label, itemSearchKeyword)}</span>
                  )}
                  noOptionsMessage={() => 'Item not found'}
                  className={errors.item_id ? 'animate-pulse' : ''}
                  classNames={getReactSelectClassNames(Boolean(errors.item_id), modalMode === 'edit')}
                />
                {errors.item_id && <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.item_id}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Selling Location</label>
                <Select<LocationSelectOption, false>
                  options={sellingLocationOptions}
                  value={selectedLocationOption}
                  onChange={handleLocationSelectChange}
                  onInputChange={handleLocationSearchInputChange}
                  isSearchable
                  isClearable
                  isDisabled={modalMode === 'edit'}
                  placeholder="Select or search selling location"
                  formatOptionLabel={(option) => (
                    <span>{renderHighlightedLabel(option.label, locationSearchKeyword)}</span>
                  )}
                  noOptionsMessage={() => 'Selling location not found'}
                  className={errors.selling_location ? 'animate-pulse' : ''}
                  classNames={getReactSelectClassNames(Boolean(errors.selling_location), modalMode === 'edit')}
                />
                {errors.selling_location && (
                  <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.selling_location}</p>
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
                    value={formData.selling_price}
                    onChange={(e) => handleSellingPriceChange(e.target.value)}
                    disabled={modalMode === 'edit' || !formData.item_id}
                    className={`w-full rounded-md border py-2 pl-10 pr-3 focus:outline-none focus:ring-2 transition-all ${
                      errors.selling_price
                        ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                        : 'border-slate-300 focus:ring-blue-500'
                    } ${modalMode === 'edit' || !formData.item_id ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                    placeholder="0"
                  />
                </div>
                {errors.selling_price && <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.selling_price}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Profit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 transform font-medium text-slate-500">Rp</span>
                  <input
                    type="text"
                    name="profit"
                    autoComplete="off"
                    value={formData.profit}
                    disabled
                    className={`w-full rounded-md border py-2 pl-10 pr-3 focus:outline-none focus:ring-2 transition-all ${
                      errors.profit
                        ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                        : 'border-slate-300 focus:ring-blue-500'
                    } cursor-not-allowed bg-slate-100 text-slate-500`}
                    placeholder="0"
                  />
                </div>
                {errors.profit && <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.profit}</p>}
                {selectedItem && (
                  <p className="mt-1 text-xs text-slate-500">Base Price: Rp {selectedItem.base_price.toLocaleString()}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
                <div
                  className="relative"
                  onClick={() => {
                    if (modalMode === 'add' && startDateRef.current) {
                      startDateRef.current.showPicker?.();
                      startDateRef.current.focus();
                    }
                  }}
                >
                  <input
                    type="text"
                    value={formData.start_date ? formatDisplayDate(formData.start_date) : ''}
                    readOnly
                    placeholder="01 January 2026"
                    className={`w-full cursor-pointer rounded-md border bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                      errors.start_date
                        ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                        : 'border-slate-300 focus:ring-blue-500'
                    } ${modalMode === 'edit' ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                  />
                  {modalMode === 'add' && (
                    <input
                      ref={startDateRef}
                      type="date"
                      name="start_date"
                      autoComplete="off"
                      value={formData.start_date}
                      onChange={handleDateChange}
                      max={formData.end_date || undefined}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  )}
                </div>
                {errors.start_date && <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.start_date}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  End Date {modalMode === 'edit' ? '' : '(Optional)'}
                </label>
                <div
                  className="relative"
                  onClick={() => {
                    if (endDateRef.current) {
                      endDateRef.current.showPicker?.();
                      endDateRef.current.focus();
                    }
                  }}
                >
                  <input
                    type="text"
                    value={formData.end_date ? formatDisplayDate(formData.end_date) : ''}
                    readOnly
                    placeholder="01 January 2026"
                    className={`w-full cursor-pointer rounded-md border bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                      errors.end_date
                        ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                  <input
                    ref={endDateRef}
                    type="date"
                    name="end_date"
                    autoComplete="off"
                    value={formData.end_date}
                    onChange={handleDateChange}
                    min={modalMode === 'edit' ? getNextDateValue(formData.start_date) || undefined : formData.start_date || undefined}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
                {errors.end_date && <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.end_date}</p>}
              </div>

              {modalMode === 'edit' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                  <button
                    type="button"
                    onClick={handleStatusToggle}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 transition-colors ${
                      errors.status
                        ? 'animate-pulse border-red-500 ring-2 ring-red-200'
                        : 'border-slate-300 hover:bg-slate-50'
                    }`}
                    role="switch"
                    aria-checked={Boolean(formData.is_active)}
                  >
                    <span className="text-sm font-medium text-slate-700">{formData.is_active ? 'Active' : 'Inactive'}</span>
                    <span
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        formData.is_active ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                          formData.is_active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </span>
                  </button>
                  {errors.status && <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.status}</p>}
                </div>
              )}

              {(modalMode === 'add' ? dateRangeInvalid : editDateRangeInvalid) && (
                <p className="text-sm text-red-600">
                  {modalMode === 'edit'
                    ? 'End Date must be later than Start Date.'
                    : 'Start Date cannot be greater than End Date.'}
                </p>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex cursor-pointer items-center gap-2 rounded-md bg-slate-200 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-300"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalMode === 'add' ? dateRangeInvalid : editDateRangeInvalid}
                  className="modern-primary flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <Check size={16} />
                  {modalMode === 'edit' ? 'Update' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingOffice;
