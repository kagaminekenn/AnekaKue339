import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BanknoteArrowUp, BanknoteX, CalendarClock, CalendarDays, CheckCircle, Clock3, Eye, EyeOff, Minus, PackageCheck, PackageX, TrendingDown, TrendingUp, Truck, X, XCircle } from 'lucide-react';
import { formatCurrency } from '../utils/helper';
import { formatDeliveryDateTime } from '../utils/salesOrder';
import { supabase } from '../utils/supabase';

type DeliveryOrderRecord = {
  id: number;
  name: string;
  whatsapp: string | null;
  total_items: number;
  total_price: number;
  final_price: number | null;
  delivery_datetime: string | null;
  delivery_address: string | null;
  delivery_type: string | null;
  delivery_cost: number | null;
  is_paid: boolean | null;
  is_delivered: boolean | null;
  total_cost: number | null;
  net_income: number | null;
  remark: string | null;
};

type DeliveryOrderDetailItem = {
  id: number;
  item_name: string;
  quantity: number;
  selling_price: number;
  total_price: number;
  total_cost: number;
  net_income: number;
  is_free: boolean | null;
};

type DeliveryWidgetQueryResult = {
  records: DeliveryOrderRecord[];
};

const isSameLocalDate = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear()
  && first.getMonth() === second.getMonth()
  && first.getDate() === second.getDate();

const Home = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isDetailSensorOn, setIsDetailSensorOn] = useState(true);

  const startOfToday = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const endOfToday = useMemo(() => {
    const now = new Date(startOfToday);
    now.setHours(23, 59, 59, 999);
    return now;
  }, [startOfToday]);

  const {
    data: deliveryWidgetData,
    isLoading: isDeliveryWidgetLoading,
    isFetching: isDeliveryWidgetFetching,
  } = useQuery<DeliveryWidgetQueryResult>({
    queryKey: ['home-delivery-widget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_sales')
        .select('id,name,whatsapp,total_items,total_price,final_price,delivery_datetime,delivery_address,delivery_type,delivery_cost,is_paid,is_delivered,total_cost,net_income,remark')
        .not('delivery_datetime', 'is', null)
        .gte('delivery_datetime', startOfToday.toISOString())
        .order('delivery_datetime', { ascending: true });

      if (error) {
        throw error;
      }

      return {
        records: (data ?? []) as DeliveryOrderRecord[],
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: selectedOrder,
    isLoading: isSelectedOrderLoading,
    isFetching: isSelectedOrderFetching,
  } = useQuery<DeliveryOrderRecord | null>({
    queryKey: ['home-delivery-order', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) {
        return null;
      }

      const { data, error } = await supabase
        .from('order_sales')
        .select('id,name,whatsapp,total_items,total_price,final_price,delivery_datetime,delivery_address,delivery_type,delivery_cost,is_paid,is_delivered,total_cost,net_income,remark')
        .eq('id', selectedOrderId)
        .single();

      if (error) {
        throw error;
      }

      return (data ?? null) as DeliveryOrderRecord | null;
    },
    enabled: selectedOrderId !== null,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: selectedOrderDetailItems,
    isLoading: isSelectedOrderDetailItemsLoading,
    isFetching: isSelectedOrderDetailItemsFetching,
  } = useQuery<DeliveryOrderDetailItem[]>({
    queryKey: ['home-delivery-order-items', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) {
        return [];
      }

      const { data, error } = await supabase
        .from('order_sales_detail_view')
        .select('id,item_name,quantity,selling_price,total_price,total_cost,net_income,is_free')
        .eq('order_sales_id', selectedOrderId)
        .order('id', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as DeliveryOrderDetailItem[];
    },
    enabled: selectedOrderId !== null,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!selectedOrderId) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedOrderId(null);
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedOrderId]);

  const deliveryRecords = deliveryWidgetData?.records ?? [];
  const widgetLoading = isDeliveryWidgetLoading || isDeliveryWidgetFetching;

  const todayRecords = useMemo(
    () => deliveryRecords.filter((record) => {
      if (!record.delivery_datetime) {
        return false;
      }

      const deliveryDate = new Date(record.delivery_datetime);
      return isSameLocalDate(deliveryDate, startOfToday);
    }),
    [deliveryRecords, startOfToday],
  );

  const upcomingRecords = useMemo(
    () => deliveryRecords.filter((record) => {
      if (!record.delivery_datetime) {
        return false;
      }

      const deliveryDate = new Date(record.delivery_datetime);
      return deliveryDate > endOfToday;
    }),
    [deliveryRecords, endOfToday],
  );

  const visibleTodayRecords = todayRecords.slice(0, 4);
  const visibleUpcomingRecords = upcomingRecords.slice(0, 6);

  const renderDeliveryCard = (record: DeliveryOrderRecord, tone: 'today' | 'upcoming') => {
    const deliveryDateTime = formatDeliveryDateTime(record.delivery_datetime);
    const todayCardClassName = 'border-cyan-300 bg-gradient-to-br from-cyan-100 via-white to-cyan-50 shadow-md ring-1 ring-cyan-200';
    const upcomingCardClassName = 'border-slate-200 bg-white/95 shadow-sm hover:shadow-md';

    return (
      <button
        key={record.id}
        type="button"
        onClick={() => setSelectedOrderId(record.id)}
        className={`w-full cursor-pointer rounded-xl border p-4 text-left transition ${tone === 'today' ? todayCardClassName : upcomingCardClassName}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{record.name || '-'}</p>
            <p className="mt-1 text-xs text-slate-500">{record.delivery_type || '-'}</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-cyan-800">
            <Clock3 className="h-3.5 w-3.5" />
            {deliveryDateTime.time}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
          <span>{deliveryDateTime.date}</span>
          <span>{record.total_items} items</span>
        </div>
      </button>
    );
  };

  const detailLoading = isSelectedOrderLoading || isSelectedOrderFetching;
  const detailItemsLoading = isSelectedOrderDetailItemsLoading || isSelectedOrderDetailItemsFetching;
  const detailItems = selectedOrderDetailItems ?? [];
  const paidStatus = selectedOrder?.is_paid === true;
  const deliveredStatus = selectedOrder?.is_delivered === true;
  const detailSensorClass = isDetailSensorOn ? 'select-none blur-sm' : '';

  const renderNetIncomeIndicator = (netIncome: number, sensorClass = detailSensorClass) => (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${
        netIncome > 0
          ? 'text-emerald-700'
          : netIncome < 0
            ? 'text-rose-700'
            : 'text-slate-700'
      }`}
      title={netIncome > 0 ? 'Profit' : netIncome < 0 ? 'Loss' : 'Break Even'}
      aria-label={netIncome > 0 ? 'Profit' : netIncome < 0 ? 'Loss' : 'Break Even'}
    >
      {netIncome > 0 ? <TrendingUp className="h-4 w-4" /> : netIncome < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
      <span className={sensorClass}>{formatCurrency(netIncome)}</span>
    </span>
  );

  return (
    <div className="page-enter space-y-6">
      <div className="page-header">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="inline-flex list-none items-center gap-2 p-0">
            <li className="font-semibold uppercase tracking-[0.08em] text-cyan-800">Home</li>
          </ol>
        </nav>
        <h1 className="page-title">Welcome to Aneka Kue 339</h1>
        <p className="page-subtitle">Made to stick — like memories & good taste.</p>
      </div>

      <section className="glass-panel overflow-hidden rounded-2xl border border-cyan-100">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100 px-4 py-3 sm:px-6">
          <div>
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
              <Truck className="h-4 w-4 text-cyan-700" />
              Delivery Widget
            </h2>
            <p className="mt-1 text-sm text-slate-500">Quick monitor for delivery schedule from order sales.</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-800">
            <CalendarDays className="h-3.5 w-3.5" />
            {startOfToday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>

        {widgetLoading ? (
          <div className="p-10 text-center text-slate-500">Loading delivery widget...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-3">
              <div className="flex items-center justify-between">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-cyan-800">
                  <CalendarClock className="h-4 w-4" />
                  Today
                </h3>
                <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800">{todayRecords.length}</span>
              </div>
              {visibleTodayRecords.length === 0 ? (
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-6 text-sm text-slate-600">No deliveries scheduled for today.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {visibleTodayRecords.map((record) => renderDeliveryCard(record, 'today'))}
                </div>
              )}
            </div>

            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">
                  <CalendarDays className="h-4 w-4" />
                  Upcoming
                </h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{upcomingRecords.length}</span>
              </div>
              {visibleUpcomingRecords.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-600">No upcoming deliveries.</div>
              ) : (
                <div className="space-y-3">
                  {visibleUpcomingRecords.map((record) => renderDeliveryCard(record, 'upcoming'))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {selectedOrderId !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-[min(96vw,1180px)] max-w-none overflow-y-auto rounded-2xl border border-cyan-100 bg-white p-5 shadow-2xl sm:p-6">
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
                  onClick={() => setSelectedOrderId(null)}
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100"
                  aria-label="Close delivery detail modal"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {detailLoading || !selectedOrder ? (
              <div className="rounded-xl border border-cyan-100 p-10 text-center text-slate-500">Loading delivery detail...</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedOrder.name || '-'}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">WhatsApp</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedOrder.whatsapp || '-'}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Items</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedOrder.total_items ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Price</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{formatCurrency(selectedOrder.total_price ?? 0)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Datetime</p>
                    <div className="mt-1 space-y-1 text-sm font-medium text-slate-900">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <CalendarDays className="h-4 w-4 text-cyan-700" />
                        <span>{formatDeliveryDateTime(selectedOrder.delivery_datetime).date}</span>
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap text-slate-600">
                        <Clock3 className="h-4 w-4 text-cyan-700" />
                        <span>{formatDeliveryDateTime(selectedOrder.delivery_datetime).time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Address</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedOrder.delivery_address || '-'}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Type</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedOrder.delivery_type || '-'}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Cost</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedOrder.delivery_cost === null ? '-' : formatCurrency(selectedOrder.delivery_cost)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Final Price</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{formatCurrency(selectedOrder.final_price ?? selectedOrder.total_price ?? 0)}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Remark</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{selectedOrder.remark || '-'}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Cost</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      <span className={detailSensorClass}>{formatCurrency(selectedOrder.total_cost ?? 0)}</span>
                    </p>
                  </div>
                  <div
                    className={`rounded-xl border p-4 shadow-sm ${
                      (selectedOrder.net_income ?? 0) > 0
                        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50'
                        : (selectedOrder.net_income ?? 0) < 0
                          ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50'
                          : 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Income</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          (selectedOrder.net_income ?? 0) > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : (selectedOrder.net_income ?? 0) < 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {(selectedOrder.net_income ?? 0) > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : (selectedOrder.net_income ?? 0) < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                        {(selectedOrder.net_income ?? 0) > 0 ? 'Profit' : (selectedOrder.net_income ?? 0) < 0 ? 'Loss' : 'Break Even'}
                      </span>
                    </div>
                    <p
                      className={`mt-2 text-[31px] font-bold leading-tight ${
                        (selectedOrder.net_income ?? 0) > 0 ? 'text-emerald-700' : (selectedOrder.net_income ?? 0) < 0 ? 'text-rose-700' : 'text-slate-700'
                      }`}
                    >
                      <span className={detailSensorClass}>{formatCurrency(selectedOrder.net_income ?? 0)}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Items</h3>
                    <p className="mt-1 text-sm text-slate-500">List of items from order_sales_detail_view for this transaction.</p>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-cyan-100">
                    {detailItemsLoading ? (
                      <div className="p-10 text-center text-slate-500">Loading item details...</div>
                    ) : detailItems.length === 0 ? (
                      <div className="p-10 text-center text-slate-500">No item details found.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="modern-table w-full min-w-[920px]">
                          <thead className="border-b border-cyan-100">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Item Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Qty</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Selling Price</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Is Free</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Price</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Cost</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Net Income</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cyan-50 bg-white/80">
                            {detailItems.map((item) => (
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
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
};

export default Home;