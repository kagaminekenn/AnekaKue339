import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CircleAlert, CircleCheck, Loader2, ShoppingBag, Store, TrendingUp, Wallet } from 'lucide-react'
import { formatCurrency } from '../utils/helper'
import { supabase } from '../utils/supabase'

type OfficeSalesRecord = {
  id: number
  sales_date: string
  selling_location: string
  total_solds: number
  total_leftovers: number
  total_cost: number
  total_revenue: number
  net_income: number
}

type OfficeSalesDetailRecord = {
  office_sales_id: number
  item_name: string
  solds: number
  leftovers: number | null
  covers: number | null
  total_revenue: number
  total_cost: number
  net_income: number
}

type OrderSalesRecord = {
  id: number
  delivery_datetime: string | null
  total_items: number
  total_price: number
  total_cost: number | null
  net_income: number | null
  is_paid: boolean | null
  is_delivered: boolean | null
}

type OrderSalesDetailRecord = {
  order_sales_id: number
  item_name: string
  quantity: number
  total_price: number
  total_cost: number
  net_income: number
}

type DashboardPayload = {
  officeSales: OfficeSalesRecord[]
  officeDetails: OfficeSalesDetailRecord[]
  orderSales: OrderSalesRecord[]
  orderDetails: OrderSalesDetailRecord[]
  prevOfficeSales: OfficeSalesRecord[]
  prevOrderSales: OrderSalesRecord[]
}

type PeriodPreset = '7d' | '30d' | '90d' | 'custom'

type ProductAggregate = {
  name: string
  quantity: number
  revenue: number
  cost: number
  net: number
}

type DaySeries = {
  dateKey: string
  officeRevenue: number
  orderRevenue: number
  officeNet: number
  orderNet: number
}

const DAY_MS = 24 * 60 * 60 * 1000

const toDateInput = (value: Date) => {
  const local = new Date(value)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

const minusDays = (days: number) => {
  const now = new Date()
  now.setDate(now.getDate() - days)
  return toDateInput(now)
}

const sumBy = <T,>(records: T[], selector: (record: T) => number) =>
  records.reduce((total, record) => total + selector(record), 0)

const formatPercent = (value: number) => `${value.toFixed(1)}%`

const formatDelta = (value: number) => {
  if (!Number.isFinite(value)) {
    return '0.0%'
  }

  const symbol = value > 0 ? '+' : ''
  return `${symbol}${value.toFixed(1)}%`
}

const safeGrowth = (current: number, previous: number) => {
  if (previous <= 0) {
    return current > 0 ? 100 : 0
  }
  return ((current - previous) / previous) * 100
}

const rangeDays = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  const diff = Math.floor((end.getTime() - start.getTime()) / DAY_MS)
  return Math.max(1, diff + 1)
}

const getRangeDateKeys = (from: string, to: string) => {
  const keys: string[] = []
  const length = rangeDays(from, to)
  const cursor = new Date(`${from}T00:00:00`)

  for (let index = 0; index < length; index += 1) {
    keys.push(toDateInput(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return keys
}

const Dashboard = () => {
  const [preset, setPreset] = useState<PeriodPreset>('30d')
  const [dateFrom, setDateFrom] = useState(minusDays(29))
  const [dateTo, setDateTo] = useState(toDateInput(new Date()))

  useEffect(() => {
    if (preset === 'custom') {
      return
    }

    if (preset === '7d') {
      setDateFrom(minusDays(6))
      setDateTo(toDateInput(new Date()))
      return
    }

    if (preset === '30d') {
      setDateFrom(minusDays(29))
      setDateTo(toDateInput(new Date()))
      return
    }

    setDateFrom(minusDays(89))
    setDateTo(toDateInput(new Date()))
  }, [preset])

  const queryEnabled = Boolean(dateFrom) && Boolean(dateTo) && dateFrom <= dateTo

  const { data, isLoading, isFetching, isError, error } = useQuery<DashboardPayload>({
    queryKey: ['dashboard-data', dateFrom, dateTo],
    enabled: queryEnabled,
    queryFn: async () => {
      const days = rangeDays(dateFrom, dateTo)
      const prevEnd = new Date(`${dateFrom}T00:00:00`)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - (days - 1))
      const prevFrom = toDateInput(prevStart)
      const prevTo = toDateInput(prevEnd)

      const [officeRes, orderRes, prevOfficeRes, prevOrderRes] = await Promise.all([
        supabase
          .from('office_sales')
          .select('id,sales_date,selling_location,total_solds,total_leftovers,total_cost,total_revenue,net_income')
          .gte('sales_date', dateFrom)
          .lte('sales_date', dateTo)
          .order('sales_date', { ascending: true }),
        supabase
          .from('order_sales')
          .select('id,delivery_datetime,total_items,total_price,total_cost,net_income,is_paid,is_delivered')
          .not('delivery_datetime', 'is', null)
          .gte('delivery_datetime', `${dateFrom}T00:00:00`)
          .lte('delivery_datetime', `${dateTo}T23:59:59.999`)
          .order('delivery_datetime', { ascending: true }),
        supabase
          .from('office_sales')
          .select('id,sales_date,selling_location,total_solds,total_leftovers,total_cost,total_revenue,net_income')
          .gte('sales_date', prevFrom)
          .lte('sales_date', prevTo),
        supabase
          .from('order_sales')
          .select('id,delivery_datetime,total_items,total_price,total_cost,net_income,is_paid,is_delivered')
          .not('delivery_datetime', 'is', null)
          .gte('delivery_datetime', `${prevFrom}T00:00:00`)
          .lte('delivery_datetime', `${prevTo}T23:59:59.999`),
      ])

      if (officeRes.error) {
        throw officeRes.error
      }
      if (orderRes.error) {
        throw orderRes.error
      }
      if (prevOfficeRes.error) {
        throw prevOfficeRes.error
      }
      if (prevOrderRes.error) {
        throw prevOrderRes.error
      }

      const officeSales = (officeRes.data ?? []) as OfficeSalesRecord[]
      const orderSales = (orderRes.data ?? []) as OrderSalesRecord[]
      const prevOfficeSales = (prevOfficeRes.data ?? []) as OfficeSalesRecord[]
      const prevOrderSales = (prevOrderRes.data ?? []) as OrderSalesRecord[]

      const officeIds = officeSales.map((record) => record.id)
      const orderIds = orderSales.map((record) => record.id)

      const [officeDetailRes, orderDetailRes] = await Promise.all([
        officeIds.length > 0
          ? supabase
            .from('office_sales_detail_view')
            .select('office_sales_id,item_name,solds,leftovers,covers,total_revenue,total_cost,net_income')
            .in('office_sales_id', officeIds)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length > 0
          ? supabase
            .from('order_sales_detail_view')
            .select('order_sales_id,item_name,quantity,total_price,total_cost,net_income')
            .in('order_sales_id', orderIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (officeDetailRes.error) {
        throw officeDetailRes.error
      }
      if (orderDetailRes.error) {
        throw orderDetailRes.error
      }

      return {
        officeSales,
        officeDetails: (officeDetailRes.data ?? []) as OfficeSalesDetailRecord[],
        orderSales,
        orderDetails: (orderDetailRes.data ?? []) as OrderSalesDetailRecord[],
        prevOfficeSales,
        prevOrderSales,
      }
    },
    staleTime: 1000 * 60 * 5,
  })

  const officeSales = data?.officeSales ?? []
  const officeDetails = data?.officeDetails ?? []
  const orderSales = data?.orderSales ?? []
  const orderDetails = data?.orderDetails ?? []
  const prevOfficeSales = data?.prevOfficeSales ?? []
  const prevOrderSales = data?.prevOrderSales ?? []

  const officeRevenue = sumBy(officeSales, (record) => record.total_revenue)
  const officeCost = sumBy(officeSales, (record) => record.total_cost)
  const officeNet = sumBy(officeSales, (record) => record.net_income)
  const officeSolds = sumBy(officeSales, (record) => record.total_solds)
  const officeLeftovers = sumBy(officeSales, (record) => record.total_leftovers)

  const orderRevenue = sumBy(orderSales, (record) => record.total_price)
  const orderCost = sumBy(orderSales, (record) => record.total_cost ?? 0)
  const orderNet = sumBy(orderSales, (record) => record.net_income ?? ((record.total_price ?? 0) - (record.total_cost ?? 0)))
  const orderItems = sumBy(orderSales, (record) => record.total_items)

  const totalRevenue = officeRevenue + orderRevenue
  const totalCost = officeCost + orderCost
  const totalNet = officeNet + orderNet
  const totalItems = officeSolds + orderItems

  const prevTotalRevenue = sumBy(prevOfficeSales, (record) => record.total_revenue) + sumBy(prevOrderSales, (record) => record.total_price)
  const prevTotalNet = sumBy(prevOfficeSales, (record) => record.net_income) + sumBy(prevOrderSales, (record) => record.net_income ?? ((record.total_price ?? 0) - (record.total_cost ?? 0)))
  const revenueGrowth = safeGrowth(totalRevenue, prevTotalRevenue)
  const netGrowth = safeGrowth(totalNet, prevTotalNet)

  const paidRate = useMemo(() => {
    if (orderSales.length === 0) {
      return 0
    }

    const paidCount = orderSales.filter((record) => record.is_paid === true).length
    return (paidCount / orderSales.length) * 100
  }, [orderSales])

  const deliveredRate = useMemo(() => {
    if (orderSales.length === 0) {
      return 0
    }

    const deliveredCount = orderSales.filter((record) => record.is_delivered === true).length
    return (deliveredCount / orderSales.length) * 100
  }, [orderSales])

  const leftoverRate = officeSolds + officeLeftovers > 0
    ? (officeLeftovers / (officeSolds + officeLeftovers)) * 100
    : 0

  const channelShare = totalRevenue > 0
    ? {
      office: (officeRevenue / totalRevenue) * 100,
      order: (orderRevenue / totalRevenue) * 100,
    }
    : { office: 0, order: 0 }

  const topProducts = useMemo<ProductAggregate[]>(() => {
    const aggregate = new Map<string, ProductAggregate>()

    for (const record of officeDetails) {
      const key = record.item_name || 'Unknown Item'
      const prev = aggregate.get(key)
      aggregate.set(key, {
        name: key,
        quantity: (prev?.quantity ?? 0) + record.solds,
        revenue: (prev?.revenue ?? 0) + record.total_revenue,
        cost: (prev?.cost ?? 0) + record.total_cost,
        net: (prev?.net ?? 0) + record.net_income,
      })
    }

    for (const record of orderDetails) {
      const key = record.item_name || 'Unknown Item'
      const prev = aggregate.get(key)
      aggregate.set(key, {
        name: key,
        quantity: (prev?.quantity ?? 0) + record.quantity,
        revenue: (prev?.revenue ?? 0) + record.total_price,
        cost: (prev?.cost ?? 0) + record.total_cost,
        net: (prev?.net ?? 0) + record.net_income,
      })
    }

    return Array.from(aggregate.values())
      .sort((first, second) => second.revenue - first.revenue)
      .slice(0, 8)
  }, [officeDetails, orderDetails])

  const lowMarginProducts = useMemo(
    () => topProducts
      .filter((product) => product.revenue > 0)
      .map((product) => ({
        ...product,
        margin: (product.net / product.revenue) * 100,
      }))
      .sort((first, second) => first.margin - second.margin)
      .slice(0, 3),
    [topProducts],
  )

  const locationPerformance = useMemo(() => {
    const grouped = new Map<string, { revenue: number; net: number; solds: number }>()

    for (const record of officeSales) {
      const key = record.selling_location || 'Unknown Location'
      const prev = grouped.get(key)
      grouped.set(key, {
        revenue: (prev?.revenue ?? 0) + record.total_revenue,
        net: (prev?.net ?? 0) + record.net_income,
        solds: (prev?.solds ?? 0) + record.total_solds,
      })
    }

    return Array.from(grouped.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((first, second) => second.revenue - first.revenue)
  }, [officeSales])

  const daySeries = useMemo<DaySeries[]>(() => {
    const base = new Map<string, DaySeries>()
    for (const key of getRangeDateKeys(dateFrom, dateTo)) {
      base.set(key, {
        dateKey: key,
        officeRevenue: 0,
        orderRevenue: 0,
        officeNet: 0,
        orderNet: 0,
      })
    }

    for (const record of officeSales) {
      const key = record.sales_date
      const current = base.get(key)
      if (!current) {
        continue
      }
      current.officeRevenue += record.total_revenue
      current.officeNet += record.net_income
    }

    return Array.from(base.values()).filter((series) => series.officeRevenue > 0)
  }, [dateFrom, dateTo, officeSales])

  const visibleSeries = daySeries.slice(-7)
  const maxVisibleRevenue = Math.max(
    1,
    ...visibleSeries.map((series) => series.officeRevenue),
  )

  const bestDay = useMemo(() => {
    if (daySeries.length === 0) {
      return null
    }

    const sorted = [...daySeries].sort(
      (first, second) => (second.officeRevenue + second.orderRevenue) - (first.officeRevenue + first.orderRevenue),
    )
    return sorted[0] ?? null
  }, [daySeries])

  const inventoryAlert = useMemo(() => {
    if (officeDetails.length === 0) {
      return null
    }

    const grouped = new Map<string, number>()
    for (const record of officeDetails) {
      grouped.set(record.item_name, (grouped.get(record.item_name) ?? 0) + (record.leftovers ?? 0))
    }

    const sorted = Array.from(grouped.entries()).sort((first, second) => second[1] - first[1])
    return sorted[0] ?? null
  }, [officeDetails])

  const highestCovers = useMemo(() => {
    if (officeDetails.length === 0 || officeSales.length === 0) {
      return null
    }

    const dateByOfficeId = new Map<number, string>()
    for (const record of officeSales) {
      dateByOfficeId.set(record.id, record.sales_date)
    }

    let best: { dateKey: string; itemName: string; covers: number } | null = null
    for (const record of officeDetails) {
      const dateKey = dateByOfficeId.get(record.office_sales_id)
      if (!dateKey) {
        continue
      }

      const covers = record.covers ?? 0
      if (!best || covers > best.covers) {
        best = {
          dateKey,
          itemName: record.item_name || 'Unknown Item',
          covers,
        }
      }
    }

    return best
  }, [officeDetails, officeSales])

  return (
    <div className="page-enter space-y-6">
      <div className="page-header">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="inline-flex list-none items-center gap-2 p-0">
            <li>Home</li>
            <li>/</li>
            <li className="font-semibold uppercase tracking-[0.08em] text-cyan-800">Dashboard</li>
          </ol>
        </nav>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Monitor office sales performance and orders in one concise view.</p>
      </div>

      <section className="glass-panel rounded-3xl border border-cyan-100 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Analysis Period</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '7d', label: '7 Days' },
                { value: '30d', label: '30 Days' },
                { value: '90d', label: '90 Days' },
                { value: 'custom', label: 'Custom' },
              ].map((option) => {
                const isActive = preset === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreset(option.value as PeriodPreset)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${isActive ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-cyan-100 bg-white text-slate-700 hover:bg-cyan-50'}`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setPreset('custom')
                  setDateFrom(event.target.value)
                }}
                className="modern-input w-full px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setPreset('custom')
                  setDateTo(event.target.value)
                }}
                className="modern-input w-full px-3 py-2"
              />
            </label>
          </div>
        </div>
      </section>

      {!queryEnabled && (
        <div className="glass-panel rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Invalid date range. Make sure the start date is not greater than the end date.
        </div>
      )}

      {queryEnabled && (isLoading || isFetching) && (
        <div className="glass-panel flex items-center justify-center gap-3 rounded-3xl border border-cyan-100 p-10 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-700" />
          <span>Loading dashboard insights...</span>
        </div>
      )}

      {queryEnabled && isError && (
        <div className="glass-panel rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load dashboard: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {queryEnabled && !isLoading && !isFetching && !isError && (
        <>
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Revenue</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
                  <p className={`mt-1 text-xs font-semibold ${revenueGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatDelta(revenueGrowth)} vs previous period
                  </p>
                </div>
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </article>

            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Net Income</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(totalNet)}</p>
                  <p className={`mt-1 text-xs font-semibold ${netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatDelta(netGrowth)} vs previous period
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </article>

            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Items Sold</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{totalItems.toLocaleString('id-ID')}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Office {officeSolds.toLocaleString('id-ID')} • Order {orderItems.toLocaleString('id-ID')}</p>
                </div>
                <div className="rounded-xl bg-sky-50 p-2 text-sky-700">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
            </article>

            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Cost</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(totalCost)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Margin {totalRevenue > 0 ? formatPercent((totalNet / totalRevenue) * 100) : '0.0%'}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-2 text-amber-700">
                  <Store className="h-5 w-5" />
                </div>
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <article className="glass-panel rounded-2xl border border-cyan-100 p-4 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Daily Trend (Last 7 Days)</h2>
                  <p className="text-sm text-slate-500">Office sales performance.</p>
                </div>
                <CalendarDays className="h-5 w-5 text-cyan-700" />
              </div>

              <div className="mt-4 space-y-3">
                {visibleSeries.map((series) => {
                  const barPercent = (series.officeRevenue / maxVisibleRevenue) * 100

                  return (
                    <div key={series.dateKey} className="rounded-xl border border-slate-100 bg-white/70 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-700">{new Date(`${series.dateKey}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</p>
                        <p className="text-sm font-semibold text-slate-700">{formatCurrency(series.officeRevenue)}</p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                          style={{ width: `${Math.max(3, barPercent)}%` }}
                        />
                      </div>
                      <p className={`mt-2 text-xs font-semibold ${series.officeNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Net {formatCurrency(series.officeNet)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </article>

            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Revenue Channel Mix</h2>
              <p className="text-sm text-slate-500">Distribution of revenue contributions between channels.</p>
              <div className="mt-4 flex items-center justify-center">
                <div
                  className="relative h-36 w-36 rounded-full"
                  style={{
                    background: `conic-gradient(#0891b2 0% ${channelShare.office}%, #10b981 ${channelShare.office}% 100%)`,
                  }}
                  aria-label="Channel revenue share"
                >
                  <div className="absolute inset-[20%] grid place-items-center rounded-full bg-white text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Total</p>
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-cyan-100 bg-cyan-50/70 px-3 py-2">
                  <span className="font-semibold text-cyan-800">Office Sales</span>
                  <span className="font-semibold text-cyan-900">{formatPercent(channelShare.office)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                  <span className="font-semibold text-emerald-800">Order Sales</span>
                  <span className="font-semibold text-emerald-900">{formatPercent(channelShare.order)}</span>
                </div>
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <article className="glass-panel rounded-2xl border border-cyan-100 p-4 xl:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">Top Products</h2>
              <p className="text-sm text-slate-500">Products with the highest revenue contribution (combined office and order).</p>

              <div className="mt-4 overflow-x-auto">
                <table className="modern-table min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Revenue</th>
                      <th className="px-3 py-2 text-right">Net</th>
                      <th className="px-3 py-2 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-slate-500">No product data available for this period.</td>
                      </tr>
                    )}
                    {topProducts.map((product) => {
                      const margin = product.revenue > 0 ? (product.net / product.revenue) * 100 : 0
                      return (
                        <tr key={product.name} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-700">{product.name}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{product.quantity.toLocaleString('en-US')}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(product.revenue)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${product.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(product.net)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatPercent(margin)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Operational Health</h2>
              <p className="text-sm text-slate-500">Indicators of sales execution and fulfillment quality.</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Paid Rate</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{formatPercent(paidRate)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Delivered Rate</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{formatPercent(deliveredRate)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Office Leftover Rate</p>
                  <p className={`mt-1 text-lg font-bold ${leftoverRate > 15 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatPercent(leftoverRate)}</p>
                </div>
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Brief Insights</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <p>
                    Best day: <span className="font-semibold">{bestDay ? new Date(`${bestDay.dateKey}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</span>
                    {' '}with revenue <span className="font-semibold">{bestDay ? formatCurrency(bestDay.officeRevenue + bestDay.orderRevenue) : '-'}</span>.
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p>
                    Low margin product: <span className="font-semibold">{lowMarginProducts[0]?.name ?? '-'}</span>
                    {' '}({lowMarginProducts[0] ? formatPercent(lowMarginProducts[0].margin) : '0.0%'}). Consider evaluating the selling price or production cost.
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50/70 p-3">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <p>
                    Stock alert: highest leftover at <span className="font-semibold">{inventoryAlert?.[0] ?? '-'}</span>
                    {' '}with <span className="font-semibold">{(inventoryAlert?.[1] ?? 0).toLocaleString('en-US')}</span> items.
                  </p>
                </div>
              </div>
            </article>

            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Office Location Performance</h2>
              <p className="text-sm text-slate-500">Comparison of performance across office sales locations.</p>
              <div className="mt-4 space-y-3">
                {locationPerformance.length === 0 && (
                  <p className="rounded-xl border border-slate-200 bg-white/70 p-3 text-sm text-slate-500">No location data available for this period.</p>
                )}
                {locationPerformance.map((location) => (
                  <div key={location.name} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-800">{location.name}</p>
                      <p className={`text-sm font-semibold ${location.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(location.net)}</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>Revenue {formatCurrency(location.revenue)}</span>
                      <span>Qty {location.solds.toLocaleString('en-US')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-4">
            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Highest Covers</h2>
              <p className="text-sm text-slate-500">Top covers record within the selected date range.</p>
              <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Day</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {highestCovers ? new Date(`${highestCovers.dateKey}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Item Name</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{highestCovers?.itemName ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Covers</p>
                    <p className="mt-1 text-sm font-semibold text-cyan-800">{(highestCovers?.covers ?? 0).toLocaleString('en-US')}</p>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Office Revenue</p>
              <p className="mt-2 text-lg font-bold text-cyan-800">{formatCurrency(officeRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500">Leftover: {officeLeftovers.toLocaleString('en-US')} item</p>
            </article>
            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Order Revenue</p>
              <p className="mt-2 text-lg font-bold text-emerald-700">{formatCurrency(orderRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500">Orders: {orderSales.length.toLocaleString('en-US')}</p>
            </article>
            <article className="glass-panel rounded-2xl border border-cyan-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Active Range</p>
              <p className="mt-2 text-lg font-bold text-slate-900">{rangeDays(dateFrom, dateTo)} days</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(`${dateFrom}T00:00:00`).toLocaleDateString('en-US')} - {new Date(`${dateTo}T00:00:00`).toLocaleDateString('en-US')}</p>
            </article>
          </section>
        </>
      )}
    </div>
  )
}

export default Dashboard
