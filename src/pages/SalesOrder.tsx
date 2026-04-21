import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BanknoteArrowUp, BanknoteX, CalendarDays, CheckCircle, CheckCircle2, Clock3, Eye, EyeOff, Minus, MinusCircle, PackageCheck, PackageX, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp, X, XCircle } from 'lucide-react';
import Pagination from '../components/Pagination';
import { formatCurrency } from '../utils/helper';
import { supabase } from '../utils/supabase';

type OrderSalesRecord = {
  id: number;
  name: string;
  whatsapp: string;
  delivery_datetime: string | null;
  delivery_type: string | null;
  is_paid: boolean | null;
  is_delivered: boolean | null;
  total_items: number;
  total_price: number;
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

const formatDeliveryDateTime = (dateTimeString: string | null) => {
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

const PLACEHOLDER_WORDS = ['Name', 'Whatsapp'];
type PlaceholderPhase = 'typing' | 'pausing' | 'deleting';
type SortField = 'name' | 'whatsapp' | 'delivery_datetime' | 'delivery_type' | 'total_items' | 'total_price' | 'is_paid' | 'is_delivered';
type SortDirection = 'asc' | 'desc';

const ORDER_DETAIL_EXCLUDED_FIELDS = new Set(['id', 'created_date', 'updated_date', 'user_update', 'is_paid', 'is_delivered']);
const TABLE_PAGE_SIZE = 3;

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

const SalesOrder = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortField, setSortField] = useState<SortField>('delivery_datetime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detailCurrentPage, setDetailCurrentPage] = useState(1);
  const [isDetailSensorOn, setIsDetailSensorOn] = useState(true);
  const [placeholderWordIndex, setPlaceholderWordIndex] = useState(0);
  const [placeholderCharCount, setPlaceholderCharCount] = useState(0);
  const [placeholderPhase, setPlaceholderPhase] = useState<PlaceholderPhase>('typing');

  const handleOpenDetail = (orderId: number) => {
    setSelectedOrderId(orderId);
    setDetailCurrentPage(1);
    setIsDetailSensorOn(true);
  };

  const handleCloseDetail = () => {
    setSelectedOrderId(null);
    setDetailCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    setCurrentPage(1);
    if (field === sortField) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('asc');
  };

  const getSortIndicator = (field: SortField) => {
    if (field !== sortField) {
      return '\u2195';
    }

    return sortDirection === 'asc' ? '\u2191' : '\u2193';
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
      setCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!selectedOrderId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseDetail();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [selectedOrderId]);

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
    queryKey: ['order-sales', currentPage, searchKeyword, sortField, sortDirection],
    queryFn: async () => {
      const from = (currentPage - 1) * TABLE_PAGE_SIZE;
      const to = from + TABLE_PAGE_SIZE - 1;

      let query = supabase
        .from('order_sales')
        .select('id,name,whatsapp,delivery_datetime,delivery_type,is_paid,is_delivered,total_items,total_price', {
          count: 'exact',
        })
        .order(sortField, { ascending: sortDirection === 'asc', nullsFirst: false })
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

  const records = orderSalesData?.records ?? [];
  const totalItems = orderSalesData?.totalItems ?? 0;
  const loading = isLoading || isFetching;
  const hasKeyword = useMemo(() => searchKeyword.length > 0, [searchKeyword]);
  const detailRecords = orderSalesDetailItemsData?.records ?? [];
  const detailTotalItems = orderSalesDetailItemsData?.totalItems ?? 0;
  const detailLoading = isOrderDetailItemsLoading || isOrderDetailItemsFetching;
  const orderDetailLoading = isOrderDetailLoading || isOrderDetailFetching;
  const detailSensorClass = isDetailSensorOn ? 'select-none blur-sm' : '';

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

  const renderNetIncomeIndicator = (netIncome: number) => (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${
        netIncome > 0 ? 'text-emerald-700' : netIncome < 0 ? 'text-rose-700' : 'text-slate-700'
      }`}
      title={netIncome > 0 ? 'Profit' : netIncome < 0 ? 'Loss' : 'Break Even'}
      aria-label={netIncome > 0 ? 'Profit' : netIncome < 0 ? 'Loss' : 'Break Even'}
    >
      {netIncome > 0 ? <TrendingUp className="h-4 w-4" /> : netIncome < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
      <span className={detailSensorClass}>{formatCurrency(netIncome)}</span>
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
    <div className="page-enter space-y-6">
      <div className="page-header">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="list-none p-0 inline-flex flex-wrap items-center gap-2">
            <li>Home</li>
            <li>/</li>
            <li className="font-semibold text-slate-900">Sales</li>
            <li>/</li>
            <li className="font-semibold uppercase tracking-[0.08em] text-cyan-800">Order</li>
          </ol>
        </nav>
        <h1 className="page-title">Order Sales</h1>
        <p className="page-subtitle">Monitor and manage sales data from order channels efficiently.</p>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl border border-cyan-100">
        <div className="flex flex-col gap-3 border-b border-cyan-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={`Search ${animatedPlaceholderText}`}
              className="w-full rounded-lg border border-cyan-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-cyan-200 transition focus:ring-2"
            />
          </div>
          <button
            type="button"
            onClick={() => alert('Fitur Add akan segera tersedia.')}
            className="modern-primary flex cursor-pointer items-center justify-center gap-2 px-4 py-2 font-medium"
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading order sales...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="modern-table w-full min-w-[1120px]">
              <thead className="border-b border-cyan-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('name')} className="inline-flex cursor-pointer items-center gap-1">
                      Name
                      <span>{getSortIndicator('name')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('whatsapp')} className="inline-flex cursor-pointer items-center gap-1">
                      Whatsapp
                      <span>{getSortIndicator('whatsapp')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('delivery_datetime')} className="inline-flex cursor-pointer items-center gap-1">
                      Delivery Datetime
                      <span>{getSortIndicator('delivery_datetime')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('delivery_type')} className="inline-flex cursor-pointer items-center gap-1">
                      Delivery Type
                      <span>{getSortIndicator('delivery_type')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('total_items')} className="inline-flex cursor-pointer items-center gap-1">
                      Total Items
                      <span>{getSortIndicator('total_items')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('total_price')} className="inline-flex cursor-pointer items-center gap-1">
                      Total Price
                      <span>{getSortIndicator('total_price')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('is_paid')} className="inline-flex cursor-pointer items-center gap-1">
                      Paid
                      <span>{getSortIndicator('is_paid')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                    <button type="button" onClick={() => handleSort('is_delivered')} className="inline-flex cursor-pointer items-center gap-1">
                      Delivered
                      <span>{getSortIndicator('is_delivered')}</span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-50 bg-white/80">
                {records.map((record) => {
                  const deliveryDateTime = formatDeliveryDateTime(record.delivery_datetime);

                  return (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.name || '-'}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.whatsapp || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">
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
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">{record.delivery_type || '-'}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.total_items ?? 0}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      {formatCurrency(record.total_price ?? 0)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      <div className="flex justify-center">
                        <StatusIcon value={record.is_paid} label="Paid" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      <div className="flex justify-center">
                        <StatusIcon value={record.is_delivered} label="Delivered" />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(record.id)}
                          title="View detail"
                          aria-label={`View detail ${record.name}`}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => alert(`Fitur Edit untuk ${record.name} akan segera tersedia.`)}
                          title="Edit"
                          aria-label={`Edit ${record.name}`}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-cyan-200 text-cyan-700 transition-colors hover:bg-cyan-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => alert(`Fitur Delete untuk ${record.name} akan segera tersedia.`)}
                          title="Delete"
                          aria-label={`Delete ${record.name}`}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-rose-200 text-rose-700 transition-colors hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="p-10 text-center text-slate-500">
            {hasKeyword ? 'Tidak ada data yang cocok dengan pencarian.' : 'Belum ada data order sales.'}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={TABLE_PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-[min(96vw,1560px)] max-w-none overflow-y-auto rounded-2xl border border-cyan-100 bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Order Sales Detail</h2>
                <p className="mt-1 text-sm text-slate-500">Detailed summary and order items for the selected transaction.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Paid</span>
                  <span className={`inline-flex rounded-full p-1.5 ${paidStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {paidStatus ? <BanknoteArrowUp className="h-6 w-6" /> : <BanknoteX className="h-6 w-6" />}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Delivered</span>
                  <span className={`inline-flex rounded-full p-1.5 ${deliveredStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {deliveredStatus ? <PackageCheck className="h-6 w-6" /> : <PackageX className="h-6 w-6" />}
                  </span>
                </div>
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

            <div className="space-y-8">
              <div className="space-y-4">
                {orderDetailLoading ? (
                  <div className="rounded-2xl border border-cyan-100 p-10 text-center text-slate-500">Loading detail data...</div>
                ) : detailEntries.length === 0 ? (
                  <div className="rounded-2xl border border-cyan-100 p-10 text-center text-slate-500">No detail data found.</div>
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
                        <div key={key} className={`rounded-xl border border-cyan-100 bg-cyan-50/60 p-4 ${remainderSpanClass}`}>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{formatFieldLabel(key)}</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{renderDetailFieldValue(key, value)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Items</h3>
                  <p className="mt-1 text-sm text-slate-500">List of items from order_sales_detail_view for this transaction.</p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-cyan-100">
                  {detailLoading ? (
                    <div className="p-10 text-center text-slate-500">Loading item details...</div>
                  ) : detailRecords.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">No item details found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="modern-table w-full min-w-[980px]">
                        <thead className="border-b border-cyan-100">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Item Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Quantity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Selling Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Is Free</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Cost</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Net Income</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cyan-50 bg-white/80">
                          {detailRecords.map((item) => (
                            <tr key={item.id}>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{item.item_name || '-'}</td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{item.quantity ?? 0}</td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{formatCurrency(item.selling_price ?? 0)}</td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                                {item.is_free ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{formatCurrency(item.total_price ?? 0)}</td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                                <span className={detailSensorClass}>{formatCurrency(item.total_cost ?? 0)}</span>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{renderNetIncomeIndicator(item.net_income ?? 0)}</td>
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
                      pageSize={TABLE_PAGE_SIZE}
                      onPageChange={setDetailCurrentPage}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesOrder;
