'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
    TrendingUp,
    CreditCard,
    Package,
    DollarSign,
    User as UserIcon,
    BarChart3,
    PieChart as PieIcon,
    Award,
    AlertCircle,
    Download,
    RefreshCw,
    Users as UsersIcon,
} from 'lucide-react'
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
} from 'recharts'
import ApiService from '../services/apiService'

/* =======================
 * Types (compact)
 * ======================= */
export type DateRange = { startDate: string; endDate: string }
export type Props = {
    userId?: string
    userName?: string
    userIdsCsv?: string
    dateRange: DateRange
    onlyCompleted?: boolean
}

export type SaleDetailRow = {
    sale_id?: number
    date: string
    time: string
    product_name?: string
    quantity?: number
    unit_price?: number
    total_amount: number
    item_subtotal?: number
    payment_method?: string
    client_id?: number | null
    client_name?: string
    total_qty?: number
    user_id?: number
    seller?: string
}

export type InventoryRow = {
    movement_id?: number
    movement_timestamp?: string
    product_name?: string
    tank_name?: string
    movement_type: 'in' | 'out' | 'adjust' | 'Entrada' | 'Salida' | 'Ajuste'
    quantity: number
    reason?: string
}

export type CollectionRow = {
    payment_id?: number
    client_id?: number
    client_name?: string
    amount: number
    payment_date: string
    payment_method?: string
}

export type ShiftRow = {
    shift_id?: number | null
    shift_name: string
    count: number
    gross: number
}

/* =======================
 * Utils (reusable + tiny)
 * ======================= */
const CURRENCY = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const fmtMoney = (n: number) => CURRENCY.format(Number(n || 0))
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-PE') : '')
const hhmm = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''

const val = <T,>(...cands: T[]) => cands.find((x) => x !== undefined && x !== null)
const labelClient = (name?: string | null, id?: number | null) => (name?.trim() ? name : id ? `Cliente #${id}` : 'Venta normal')
const labelSeller = (id?: number, name?: string | null) => (name?.trim() ? name : id ? `Usuario #${id}` : '—')

const qs = (obj: Record<string, any>) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)).toString()

const authHeaders = (): HeadersInit => {
    const h = new Headers();
    if (typeof window !== 'undefined') {
        const token =
            sessionStorage.getItem('token') || localStorage.getItem('authToken');
        if (token) h.set('Authorization', `Bearer ${token}`);
    }
    return h;
};


const fetchJson = async (url: string) => {
    const resp = await fetch(url, { headers: authHeaders() })
    if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`)
    return resp.json()
}

/* =======================
 * Normalizers (small + tolerant)
 * ======================= */
const normalizeSalesFromArray = (list: any[]): SaleDetailRow[] =>
    (list || []).flatMap((s) => {
        const base: SaleDetailRow = {
            sale_id: Number(s.sale_id),
            date: s.sale_timestamp,
            time: hhmm(s.sale_timestamp),
            payment_method: val(s.payment_method, s.paymentMethod?.method_name, 'Efectivo'),
            client_id: val<number | null>(s.client_id, s.client?.client_id) ?? null,
            client_name: labelClient(val(s.client_name, s.client?.full_name), val(s.client_id, s.client?.client_id)),
            total_qty: val(s.total_qty, s.total_quantity),
            user_id: s.user_id,
            seller: labelSeller(s.user_id, val(s.user_name, s.user?.full_name)),
            total_amount: Number(val(s.total_amount, s.total)),
        }
        const items = val<any[]>(s.items, s.saleDetails) || []
        return items.length
            ? (items.map((it) => ({
                ...base,
                product_name: val(it.product_name, it.product?.name) ?? '—',
                quantity: Number(val(it.quantity, it.qty, 0)),
                unit_price: Number(val(it.unit_price, it.unit_price_at_sale, 0)),
                item_subtotal: Number(val(it.subtotal, 0)),
            })) as SaleDetailRow[])
            : ([{ ...base, product_name: '—', quantity: 0, unit_price: 0, item_subtotal: 0 }] as SaleDetailRow[])
    })

const normalizeInventory = (raw: any[]): InventoryRow[] =>
    (Array.isArray(raw) ? raw : [])
        .map((m) =>
            typeof m === 'object' && m
                ? {
                    movement_id: val(m.movement_id, m.stock_movement_id, m.id),
                    movement_timestamp: val(
                        m.movement_timestamp, m.timestamp, m.created_at, m.createdAt, m.date,
                        m.fecha_hora
                    ),
                    product_name: val(
                        m.product?.name, m.product_name,
                        m.producto
                    ),
                    tank_name: val(
                        m.tank?.tank_name, m.tank_name,
                        m.tanque
                    ),
                    movement_type: String(
                        val(m.movement_type, m.type, m.tipo, '')
                    ) as InventoryRow['movement_type'],
                    quantity: Number(val(m.quantity, m.qty, m.cantidad, 0)),
                    reason: val(m.reason, m.note, m.description, m.motivo),
                }
                : null,
        )
        .filter(Boolean) as InventoryRow[]

/* =======================
 * Small chart cards (DRY UI)
 * ======================= */
const LineCard: React.FC<{ title: string; days: number; data: any[]; dataKey: string; color?: string; labelFmt?: (s: string) => string; yFmt?: (n: number) => any }>
    = ({ title, days, data, dataKey, color = '#f97316', labelFmt = fmtDate, yFmt }) => (
        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-white">{title}</h5>
                <span className="text-slate-400 text-xs">{days} días</span>
            </div>
            <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => (yFmt ? yFmt(Number(v)) : fmtMoney(Number(v)))} labelFormatter={(d) => labelFmt(String(d))} />
                        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )

const PieCard: React.FC<{ title: string; data: { name: string; value: number }[]; colors: string[] }>
    = ({ title, data, colors }) => (
        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-white">{title}</h5>
                <span className="text-slate-400 text-xs">{data.length} items</span>
            </div>
            <div className="h-56">
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                            {data.map((_, i) => (
                                <Cell key={i} fill={colors[i % colors.length]} />
                            ))}
                        </Pie>
                        <Legend />
                        <Tooltip formatter={(v: number) => fmtMoney(Number(v))} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    )

/* =======================
 * Data hook (fetch + shape)
 * ======================= */
function useEmployeeReport({ userId, userIdsCsv, dateRange, onlyCompleted }: Required<Pick<Props, 'dateRange'>> & Pick<Props, 'userId' | 'userIdsCsv' | 'onlyCompleted'>) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [summary, setSummary] = useState<any | null>(null)
    const [timeseries, setTimeseries] = useState<Array<{ date: string; gross: number }>>([])
    const [sales, setSales] = useState<SaleDetailRow[]>([])
    const [credits, setCredits] = useState<CollectionRow[]>([])
    const [createdCredits, setCreatedCredits] = useState<any[]>([])
    const [inventory, setInventory] = useState<InventoryRow[]>([])
    const [shifts, setShifts] = useState<ShiftRow[]>([])

    const multiIds = useMemo(() => (userIdsCsv || '').split(',').map((s) => s.trim()).filter(Boolean), [userIdsCsv])
    const isMulti = multiIds.length >= 2

    const base = ApiService.getBaseURL()

    const loadSalesAndAggs = useCallback(async () => {
        if (isMulti) {
            const q = qs({ userIds: userIdsCsv, startDate: dateRange.startDate, endDate: dateRange.endDate, onlyCompleted })
            const [sum, ts] = await Promise.all([
                fetchJson(`${base}/reports/summary/users?${q}`),
                fetchJson(`${base}/reports/timeseries/users?${q}`),
            ])
            setSummary(sum || null)
            setTimeseries(Array.isArray(sum?.timeseries) ? sum.timeseries : Array.isArray(ts) ? ts : [])
            setSales([])
            return
        }
        const qUser = qs({ userId, startDate: dateRange.startDate, endDate: dateRange.endDate, onlyCompleted, format: 'json' })
        const [sum, ts, det] = await Promise.all([
            fetchJson(`${base}/reports/summary/user?${qUser}`),
            fetchJson(`${base}/reports/timeseries/user?${qUser}`),
            fetchJson(`${base}/reports/user/detailed?${qUser}`),
        ])
        setSummary(sum || null)
        setTimeseries(Array.isArray(sum?.timeseries) ? sum.timeseries : Array.isArray(ts) ? ts : [])
        const salesArr = det?.sales ? normalizeSalesFromArray(det.sales) : det?.detailedSales ? normalizeSalesFromArray(det.detailedSales) : []
        setSales(salesArr)
        det?.inventoryMovements && setInventory(normalizeInventory(det.inventoryMovements))
    }, [isMulti, userIdsCsv, userId, dateRange.startDate, dateRange.endDate, onlyCompleted, base])

    const loadCredits = useCallback(async () => {
        if (isMulti) return setCredits([])
        const q = qs({ userId, startDate: dateRange.startDate, endDate: dateRange.endDate, onlyCompleted })
        const data = await fetchJson(`${base}/reports/credits/payments-by-user?${q}`)
        const list = Array.isArray(data) ? data : data?.payments ?? data?.data ?? data?.results ?? []
        const rows: CollectionRow[] = list.map((p: any) => ({
            payment_id: Number(val(p.payment_id, p.id, 0)),
            client_id: Number(val(p.client_id, p.client?.client_id, 0)) || undefined,
            client_name: val(p.client_name, p.client?.full_name, p.client?.name, '—'),
            amount: Number(val(p.amount, p.total, 0)),
            payment_date: String(val(p.payment_timestamp, p.payment_date, p.created_at, p.createdAt, p.date, '')),
            payment_method: val(p.payment_method, p.method, p.method_name, '—'),
        }))
        rows.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
        setCredits(rows)
    }, [isMulti, userId, dateRange.startDate, dateRange.endDate, onlyCompleted, base])

    const loadCreatedCredits = useCallback(async () => {
        if (isMulti) return setCreatedCredits([])
        const q = qs({ userId, startDate: dateRange.startDate, endDate: dateRange.endDate })
        const data = await fetchJson(`${base}/reports/credits/by-user?${q}`)
        const list = Array.isArray(data) ? data : data?.credits ?? data?.data ?? data?.results ?? []
        const rows = list.map((c: any) => {
            const credit_amount = Number(val(c.credit_amount, c.amount, c.total, 0))
            const amount_paid = Number(val(c.amount_paid, c.paid_amount, c.paid, 0))
            const remaining_balance = c.remaining_balance != null ? Number(c.remaining_balance) : credit_amount - amount_paid
            return {
                credit_id: Number(val(c.credit_id, c.id, 0)),
                client_id: Number(val(c.client_id, c.client?.client_id, 0)),
                client_name: val(c.client_name, c.client?.full_name, c.client?.name, '—'),
                credit_amount,
                amount_paid,
                remaining_balance,
                due_date: val(c.due_date, c.dueDate, c.expiration_date, null),
                sale_timestamp: val(c.sale_timestamp, c.created_at, c.createdAt, null),
            }
        })
        rows.sort((a: any, b: any) => new Date(b.sale_timestamp).getTime() - new Date(a.sale_timestamp).getTime())
        setCreatedCredits(rows)
    }, [isMulti, userId, dateRange.startDate, dateRange.endDate, base])

    const loadInventory = useCallback(async () => {
        if (isMulti) {
            const q = qs({ userIds: userIdsCsv, startDate: dateRange.startDate, endDate: dateRange.endDate })
            const data = await fetchJson(`${base}/reports/inventory/movements-ui/by-users?${q}`)
            const merged = (data?.data || []).flatMap((u: any) => u.rows || [])
            return setInventory(normalizeInventory(merged))
        }
        const q = qs({ userId: String(userId || ''), startDate: dateRange.startDate, endDate: dateRange.endDate })
        const data = await fetchJson(`${base}/reports/inventory/movements-ui?${q}`)
        setInventory(normalizeInventory(data?.rows || data || []))
    }, [isMulti, userIdsCsv, userId, dateRange.startDate, dateRange.endDate, base])

    const loadShifts = useCallback(async () => {
        const q = qs({ startDate: dateRange.startDate, endDate: dateRange.endDate, onlyCompleted })
        const data = await fetchJson(`${base}/reports/sales/by-shift?${q}`)
        const rows: ShiftRow[] = (Array.isArray(data) ? data : data?.rows || data?.data || []).map((r: any) => ({
            shift_id: r.shift_id ?? null,
            shift_name: r.shift_name ?? 'Sin turno',
            count: Number(r.count ?? r.orders ?? 0),
            gross: Number(r.gross ?? r.total ?? 0),
        }))
        setShifts(rows)
    }, [base, dateRange.startDate, dateRange.endDate, onlyCompleted])

    const reload = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            await loadSalesAndAggs()
            await Promise.allSettled([loadCredits(), loadCreatedCredits(), loadInventory(), loadShifts()])
        } catch (e: any) {
            console.error(e)
            setError(e?.message || 'Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }, [loadSalesAndAggs, loadCredits, loadCreatedCredits, loadInventory, loadShifts])

    useEffect(() => {
        if ((isMulti && userIdsCsv) || (!isMulti && userId)) reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, userIdsCsv, dateRange.startDate, dateRange.endDate, onlyCompleted])

    return { loading, error, summary, timeseries, sales, credits, createdCredits, inventory, shifts, isMulti, multiIds, reload }
}

/* =======================
 * Aggregations (concise)
 * ======================= */
function useKpis(summary: any, timeseries: Array<{ date: string; gross: number }>, sales: SaleDetailRow[], inventory: InventoryRow[], credits: CollectionRow[]) {
    return useMemo(() => {
        if (summary) {
            const kp = summary.kpis || {}
            let bestDay = '', bestAmount = 0
            for (const p of timeseries) if (Number(p.gross || 0) > bestAmount) { bestAmount = Number(p.gross || 0); bestDay = p.date }
            const ventasPorMetodo = (summary.byPayment || []).map((x: any) => ({ payment_method: x.label || x.key || '—', amount: Number(x.total_amount || 0), transactions: Number(x.count || 0) }))
            const ventasPorProducto = (summary.byProduct || []).map((x: any) => ({ product_name: x.product_name || x.name || '—', quantity: Number(x.total_gallons || x.qty || 0), amount: Number(x.total_amount || 0), transactions: Number(x.count || 0) }))
            const invMap = new Map<string, { count: number; qty: number }>()
            for (const m of inventory) {
                const key = m.movement_type === 'Entrada' ? 'in' : m.movement_type === 'Salida' ? 'out' : m.movement_type === 'Ajuste' ? 'adjust' : (m.movement_type as string)
                const prev = invMap.get(key) || { count: 0, qty: 0 }
                invMap.set(key, { count: prev.count + 1, qty: prev.qty + Number(m.quantity || 0) })
            }
            return {
                totalVentas: Number(kp.gross || 0),
                transacciones: Number(kp.sales_count || 0),
                promedio: Number(kp.avg_ticket || 0),
                bestDay, bestAmount,
                ventasPorProducto, ventasPorMetodo,
                invPorTipo: Array.from(invMap, ([movement_type, v]) => ({ movement_type, count: v.count, total_quantity: v.qty })),
                totalCobranzas: Number(kp.recovered_gross ?? kp.credits_gross ?? 0),
                cobranzasCount: Number(kp.credits_count ?? 0),
            }
        }

        const uniq = new Map<number, { total: number; date: string; payment?: string }>()
        for (const r of sales) {
            if (r.sale_id == null) continue
            const key = Number(r.sale_id)
            if (!uniq.has(key)) {
                uniq.set(key, {
                    total: Number(r.total_amount || 0),
                    date: r.date,
                    payment: r.payment_method || '—',
                })
            }
        }


        const transacciones = uniq.size
        const totalVentas = Array.from(uniq.values()).reduce((s, v) => s + v.total, 0)
        const promedio = transacciones ? totalVentas / transacciones : 0
        const byDay = new Map<string, number>()
        uniq.forEach((v) => byDay.set(v.date?.substring(0, 10) || '', (byDay.get(v.date?.substring(0, 10) || '') || 0) + v.total))
        let bestDay = '', bestAmount = 0
        byDay.forEach((m, d) => { if (m > bestAmount) { bestAmount = m; bestDay = d } })
        const byMeth = new Map<string, { amount: number; transactions: number }>()
        Array.from(uniq.values()).forEach((v) => { const k = v.payment || '—'; const p = byMeth.get(k) || { amount: 0, transactions: 0 }; byMeth.set(k, { amount: p.amount + v.total, transactions: p.transactions + 1 }) })
        const byProd = new Map<string, { qty: number; amount: number; tx: number }>()
        for (const r of sales) { const k = r.product_name || '-'; const p = byProd.get(k) || { qty: 0, amount: 0, tx: 0 }; byProd.set(k, { qty: p.qty + Number(r.quantity || 0), amount: p.amount + Number(r.item_subtotal || 0), tx: p.tx + 1 }) }
        const invMap = new Map<string, { count: number; qty: number }>()
        for (const m of inventory) { const key = m.movement_type === 'Entrada' ? 'in' : m.movement_type === 'Salida' ? 'out' : m.movement_type === 'Ajuste' ? 'adjust' : (m.movement_type as string); const p = invMap.get(key) || { count: 0, qty: 0 }; invMap.set(key, { count: p.count + 1, qty: p.qty + Number(m.quantity || 0) }) }
        return {
            totalVentas, transacciones, promedio, bestDay, bestAmount,
            ventasPorProducto: Array.from(byProd, ([product_name, v]) => ({ product_name, quantity: v.qty, amount: v.amount, transactions: v.tx })),
            ventasPorMetodo: Array.from(byMeth, ([payment_method, v]) => ({ payment_method, amount: v.amount, transactions: v.transactions })),
            invPorTipo: Array.from(invMap, ([movement_type, v]) => ({ movement_type, count: v.count, total_quantity: v.qty })),
            totalCobranzas: credits.reduce((s, c) => s + Number(c.amount || 0), 0),
            cobranzasCount: credits.length,
        }
    }, [summary, timeseries, sales, inventory, credits])
}

function useSalesAgg(
    timeseries: Array<{ date: string; gross: number }>,
    sales: SaleDetailRow[],
    summary?: any,
    isMulti?: boolean
) {
    return useMemo(() => {
        const byDayLegacy = timeseries.length
            ? timeseries.map((p) => ({ date: p.date, amount: Number(p.gross || 0) }))
            : Array.from(
                sales.reduce(
                    (m, r) =>
                        m.set(
                            r.date?.substring(0, 10) || '',
                            (m.get(r.date?.substring(0, 10) || '') || 0) +
                            Number(r.total_amount || 0),
                        ),
                    new Map<string, number>(),
                ),
                ([date, amount]) => ({ date, amount }),
            ).sort((a, b) => (a.date < b.date ? -1 : 1))

        // ----- MODO MULTI -----
        if (isMulti) {
            // 1) localizar la colección de usuarios en el summary (array u objeto)
            const candidates = [
                summary?.byUser,
                summary?.byUsers,
                summary?.bySeller,
                summary?.users,
                summary?.sellers,
                summary?.usersBreakdown,
                summary?.sales?.byUser,
                summary?.salesByUser,
                summary?.totalsByUser,
            ];

            let rawUsers: any[] = [];
            for (const c of candidates) {
                if (Array.isArray(c) && c.length) { rawUsers = c; break; }
                if (c && typeof c === 'object' && Object.keys(c).length) {
                    rawUsers = Object.values(c); // si vino como {"12": {...}, "15": {...}}
                    break;
                }
            }

            // 2) mapear a lo que usa el gráfico
            const bySeller = (rawUsers || []).map((u: any) => ({
                seller:
                    u.label ??
                    u.user_name ??
                    u.name ??
                    (u.user_id ?? u.id ? `Usuario #${u.user_id ?? u.id}` : '—'),
                amount: Number(
                    u.gross ??
                    u.total_amount ??
                    u.total ??
                    u.amount ??
                    u.gross_total ??
                    0
                ),
                transactions: Number(
                    u.count ??
                    u.sales_count ??
                    u.transactions ??
                    u.tx ??
                    0
                ),
            })).filter(x => x.amount > 0 || x.transactions > 0);

            // productos (esto ya te funcionaba)
            const rawProducts =
                summary?.byProduct ?? summary?.products ?? summary?.byProducts ?? [];
            const byProduct = (Array.isArray(rawProducts) ? rawProducts : Object.values(rawProducts || {}))
                .map((p: any) => ({
                    name: p.product_name ?? p.name ?? '—',
                    value: Number(p.total_amount ?? p.amount ?? p.gross ?? 0),
                }))
                .sort((a, b) => b.value - a.value);

            const byDay = timeseries.length
                ? timeseries.map((p) => ({ date: p.date, amount: Number(p.gross || 0) }))
                : [];

            return {
                uniqueArr: [] as any[],
                bySeller,
                byDay,
                byProduct,
                topSeller: bySeller[0],
                largestSale: undefined as any,
            };
        }

        // ----- MODO SINGLE (como estaba) -----
        const uniq = new Map<
            number,
            { sale_id: number; date: string; seller: string; user_id?: number; amount: number; payment?: string }
        >()
        for (const r of sales) {
            if (r.sale_id == null) continue
            const key = Number(r.sale_id)
            if (!uniq.has(key)) {
                uniq.set(key, {
                    sale_id: key,
                    date: r.date,
                    seller: r.seller ?? (r.user_id ? `Usuario #${r.user_id}` : '—'),
                    user_id: r.user_id,
                    amount: Number(r.total_amount || 0),
                    payment: r.payment_method || '—',
                })
            }
        }
        const uniqueArr = Array.from(uniq.values())

        const bySeller = Array.from(
            uniqueArr.reduce((m, u) => {
                const k = u.seller
                const p = m.get(k) || { seller: k, amount: 0, transactions: 0 }
                m.set(k, {
                    seller: k,
                    amount: p.amount + u.amount,
                    transactions: p.transactions + 1,
                })
                return m
            }, new Map<string, { seller: string; amount: number; transactions: number }>()),
        )
            .map(([_, v]) => v)
            .sort((a, b) => b.amount - a.amount)

        const byProduct = Array.from(
            sales.reduce(
                (m, r) =>
                    m.set(
                        r.product_name || '—',
                        (m.get(r.product_name || '—') || 0) + Number(r.item_subtotal || 0),
                    ),
                new Map<string, number>(),
            ),
            ([name, value]) => ({ name, value }),
        ).sort((a, b) => b.value - a.value)

        const topSeller = bySeller[0]
        const largestSale = uniqueArr.reduce(
            (mx, u) => (!mx || u.amount > mx.amount ? u : mx),
            undefined as undefined | typeof uniqueArr[number],
        )

        return { uniqueArr, bySeller, byDay: byDayLegacy, byProduct, topSeller, largestSale }
    }, [timeseries, sales, summary, isMulti])
}

function useCreditsAgg(credits: CollectionRow[]) {
    return useMemo(() => {
        const byDay = Array.from(
            credits.reduce((m, c) => m.set(String(c.payment_date).substring(0, 10), (m.get(String(c.payment_date).substring(0, 10)) || 0) + Number(c.amount || 0)), new Map<string, number>()),
            ([date, amount]) => ({ date, amount }),
        ).sort((a, b) => (a.date < b.date ? -1 : 1))
        const byMethod = Array.from(
            credits.reduce((m, c) => m.set(c.payment_method || '—', (m.get(c.payment_method || '—') || 0) + Number(c.amount || 0)), new Map<string, number>()),
            ([name, value]) => ({ name, value }),
        )
        const total = credits.reduce((s, c) => s + Number(c.amount || 0), 0)
        const count = credits.length
        const avg = count ? total / count : 0
        return { byDay, byMethod, total, count, avg }
    }, [credits])
}

/* =======================
 * Component
 * ======================= */
const CHART_COLORS = ['#f97316', '#22c55e', '#38bdf8', '#a78bfa', '#f43f5e', '#eab308']

const EmployeeDetailedReport: React.FC<Props> = ({ userId, userName, userIdsCsv, dateRange, onlyCompleted = true }) => {
    const { loading, error, summary, timeseries, sales, credits, createdCredits, inventory, shifts, isMulti, reload } = useEmployeeReport({ userId, userIdsCsv, dateRange, onlyCompleted })

    const kpis = useKpis(summary, timeseries, sales, inventory, credits)
    const salesAgg = useSalesAgg(timeseries, sales, summary, isMulti)
    const creditsAgg = useCreditsAgg(credits)

    const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'credits' | 'inventory' | 'shifts'>('overview')
    const [showSellerCol, setShowSellerCol] = useState(true)
    const [groupBySeller, setGroupBySeller] = useState(false)

    const download = async (format: 'excel' | 'pdf') => {
        try {
            const base = ApiService.getBaseURL()
            const url = isMulti
                ? `${base}/reports/summary/users?${qs({ userIds: userIdsCsv, startDate: dateRange.startDate, endDate: dateRange.endDate, onlyCompleted, format })}`
                : `${base}/reports/user/detailed?${qs({ userId, startDate: dateRange.startDate, endDate: dateRange.endDate, onlyCompleted, format })}`
            const resp = await fetch(url, { headers: authHeaders() })
            if (!resp.ok) throw new Error(`Fallo la descarga (${resp.status})`)
            const blob = await resp.blob()
            const objUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = objUrl
            a.download = isMulti
                ? `ventas_multi_${(userIdsCsv || '').replace(/,/g, '-')}_${dateRange.startDate}_${dateRange.endDate}.${format === 'excel' ? 'xlsx' : 'pdf'}`
                : `reporte_usuario_${userName || userId}_${dateRange.startDate}_${dateRange.endDate}.${format === 'excel' ? 'xlsx' : 'pdf'}`
            document.body.appendChild(a)
            a.click(); a.remove(); URL.revokeObjectURL(objUrl)
        } catch (e: any) { console.error(e); alert(e?.message || 'No se pudo descargar el archivo.') }
    }

    const downloadInventory = async (format: 'excel' | 'pdf' = 'excel') => {
        try {
            const base = ApiService.getBaseURL()
            const q = qs({ userId: String(userId), startDate: dateRange.startDate, endDate: dateRange.endDate, format })
            const resp = await fetch(`${base}/reports/inventory/movements-ui?${q}`, { headers: authHeaders() })
            if (!resp.ok) throw new Error(`Download failed ${resp.status}`)
            const blob = await resp.blob(); const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `movimientos_inventario_ui_user_${userId}_${dateRange.startDate}_${dateRange.endDate}.${format === 'excel' ? 'xlsx' : 'pdf'}`
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
        } catch (e: any) { console.error(e); alert(e?.message || 'No se pudo descargar el inventario.') }
    }

    const downloadInventoryMulti = async (format: 'excel' | 'pdf' = 'excel') => {
        try {
            const base = ApiService.getBaseURL()
            const q = qs({ userIds: userIdsCsv, startDate: dateRange.startDate, endDate: dateRange.endDate, format })
            const resp = await fetch(`${base}/reports/inventory/movements-ui/by-users?${q}`, { headers: authHeaders() })
            if (!resp.ok) throw new Error(`Fallo la descarga (${resp.status})`)
            const blob = await resp.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `movimientos_inventario_ui_users_${dateRange.startDate}_${dateRange.endDate}.${format === 'excel' ? 'xlsx' : 'pdf'}`
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
        } catch (e: any) {
            console.error(e); alert(e?.message || 'No se pudo descargar el inventario (multi).')
        }
    }

    const downloadShifts = async (format: 'excel' | 'pdf' = 'excel') => {
        try {
            const base = ApiService.getBaseURL()
            const q = qs({ startDate: dateRange.startDate, endDate: dateRange.endDate, onlyCompleted, format })
            const resp = await fetch(`${base}/reports/sales/by-shift?${q}`, { headers: authHeaders() })
            if (!resp.ok) throw new Error(`Fallo la descarga (${resp.status})`)
            const blob = await resp.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `ventas_por_turno_${dateRange.startDate}_${dateRange.endDate}.${format === 'excel' ? 'xlsx' : 'pdf'}`
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
        } catch (e: any) {
            console.error(e); alert(e?.message || 'No se pudo descargar turnos.')
        }
    }

    if (loading) {
        return (
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-8">
                <div className="flex items-center justify-center">
                    <RefreshCw className="animate-spin h-8 w-8 text-orange-500 mr-3" />
                    <span className="text-slate-300 text-lg">{isMulti ? 'Cargando ventas…' : 'Cargando datos del usuario…'}</span>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
                <div className="flex items-center">
                    <AlertCircle className="h-6 w-6 text-red-400 mr-3" />
                    <div>
                        <h3 className="text-lg font-semibold text-red-400">Error al cargar datos</h3>
                        <p className="text-slate-300">{error}</p>
                        <button onClick={reload} className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">Reintentar</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl shadow-xl border border-slate-600 p-4 sm:p-6">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center min-w-0">
                            <div className="bg-orange-500 rounded-full p-2.5 sm:p-3 mr-3 sm:mr-4 shrink-0">
                                {isMulti ? <UsersIcon className="h-7 w-7 sm:h-8 sm:w-8 text-white" /> : <UserIcon className="h-7 w-7 sm:h-8 sm:w-8 text-white" />}
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight break-words">
                                    {isMulti ? `Varios usuarios (${userIdsCsv})` : userName ? userName : `Usuario #${userId}`}
                                </h3>
                                <p className="text-slate-300 text-sm sm:text-base">{isMulti ? `IDs: ${userIdsCsv}` : `ID: ${userId}`}</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto">
                            <button onClick={reload} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                                <RefreshCw className="mr-2 h-4 w-4" />Actualizar
                            </button>
                            <button onClick={() => download('excel')} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                                <Download className="mr-2 h-4 w-4" />Excel
                            </button>
                            <button onClick={() => download('pdf')} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                                <Download className="mr-2 h-4 w-4" />PDF
                            </button>
                            {!isMulti && (
                                <button onClick={() => downloadInventory('excel')} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                                    <Package className="mr-2 h-4 w-4" />Inv. Excel
                                </button>
                            )}
                            {isMulti && (
                                <button
                                    onClick={() => downloadInventoryMulti('excel')}
                                    className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                                >
                                    <Package className="mr-2 h-4 w-4" />Inv. (multi) Excel
                                </button>
                            )}
                            <button onClick={() => downloadShifts('excel')} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
                                <Download className="mr-2 h-4 w-4" />Turnos Excel
                            </button>
                        </div>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 bg-slate-700/70 rounded-lg p-3"><strong>Período:</strong> {fmtDate(dateRange.startDate)} — {fmtDate(dateRange.endDate)}</div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs sm:text-sm">Total Ventas</p>
                            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white tabular-nums">{kpis.transacciones}</p>
                            <p className="text-[11px] sm:text-xs text-slate-500">{kpis.transacciones} transacciones</p>
                        </div>
                        <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 text-green-400" />
                    </div>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0">
                            <p className="text-slate-400 text-xs sm:text-sm">Monto Total</p>
                            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white tabular-nums break-words">{fmtMoney(kpis.totalVentas)}</p>
                            <p className="text-[11px] sm:text-xs text-slate-500">Promedio: {fmtMoney(kpis.promedio)}</p>
                        </div>
                        <DollarSign className="h-6 w-6 sm:h-7 sm:w-7 text-green-400" />
                    </div>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0">
                            <p className="text-slate-400 text-xs sm:text-sm">Cobranzas</p>
                            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white tabular-nums break-words">{fmtMoney(kpis.totalCobranzas)}</p>
                            <p className="text-[11px] sm:text-xs text-slate-500">{kpis.cobranzasCount} pagos</p>
                        </div>
                        <CreditCard className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" />
                    </div>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs sm:text-sm">Inventario</p>
                            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white tabular-nums">{inventory.length}</p>
                            <p className="text-[11px] sm:text-xs text-slate-500">movimientos totales</p>
                        </div>
                        <Package className="h-6 w-6 sm:h-7 sm:w-7 text-purple-400" />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700">
                <div className="border-b border-slate-700">
                    <nav className="flex flex-wrap gap-2 sm:gap-0 sm:space-x-8 px-4 sm:px-6">
                        {[
                            { id: 'overview', label: 'Resumen', icon: BarChart3 },
                            { id: 'sales', label: isMulti ? 'Ventas (multi)' : 'Ventas Detalladas', icon: TrendingUp },
                            { id: 'credits', label: isMulti ? 'Créditos (multi)' : 'Créditos', icon: CreditCard },
                            { id: 'inventory', label: 'Inventario', icon: Package },
                            { id: 'shifts', label: 'Turnos', icon: PieIcon },
                        ].map(({ id, label, icon: Icon }) => (
                            <button key={id} onClick={() => setActiveTab(id as any)} className={`flex items-center py-3 sm:py-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === (id as any) ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
                                <Icon className="mr-2 h-4 w-4" />{label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-4 sm:p-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <h4 className="text-base sm:text-lg font-semibold text-white mb-2">Resumen de Rendimiento</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <LineCard title="Tendencia de Ventas" days={salesAgg.byDay.length} data={salesAgg.byDay} dataKey="amount" color="#f97316" />
                                <PieCard title="Métodos de Pago" data={(kpis.ventasPorMetodo || []).map((m: any) => ({ name: m.payment_method, value: Number(m.amount || 0) }))} colors={CHART_COLORS} />
                                <PieCard title="Ventas por Producto" data={(kpis.ventasPorProducto || []).map((p: any) => ({ name: p.product_name, value: Number(p.amount || 0) })).slice(0, 8)} colors={CHART_COLORS} />
                                <LineCard title="Cobranzas por Día" days={creditsAgg.byDay.length} data={creditsAgg.byDay} dataKey="amount" color="#22c55e" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                                    <h5 className="font-semibold text-white mb-3 flex items-center"><CreditCard className="mr-2 h-4 w-4 text-green-400" />Métodos de Pago (detalle)</h5>
                                    <div className="space-y-2">
                                        {(kpis.ventasPorMetodo || []).map((m: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center">
                                                <span className="text-slate-300">{m.payment_method}</span>
                                                <div className="text-right">
                                                    <div className="text-white font-medium">{fmtMoney(m.amount)}</div>
                                                    <div className="text-xs text-slate-400">{m.transactions} transacciones</div>
                                                </div>
                                            </div>
                                        ))}
                                        {!kpis.ventasPorMetodo?.length && <div className="text-slate-400 text-sm">Sin datos en el período.</div>}
                                    </div>
                                </div>
                                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                                    <h5 className="font-semibold text-white mb-3 flex items-center"><Award className="mr-2 h-4 w-4 text-yellow-400" />Mejor Rendimiento</h5>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center"><span className="text-slate-300">Mejor Día</span><div className="text-right"><div className="text-white font-medium">{kpis.bestDay ? fmtDate(kpis.bestDay) : '—'}</div><div className="text-xs text-slate-400">{fmtMoney(kpis.bestAmount)}</div></div></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-300">Promedio por Venta</span><div className="text-white font-medium">{fmtMoney(kpis.promedio)}</div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sales' && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {!isMulti && (
                                    <>
                                        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                                            <h5 className="font-semibold text-white mb-2 flex items-center"><TrendingUp className="mr-2 h-4 w-4 text-green-400" />Vendedor con más ventas</h5>
                                            {salesAgg.topSeller ? (<><div className="text-white text-lg font-semibold">{salesAgg.topSeller.seller}</div><div className="text-slate-400 text-sm">{salesAgg.topSeller.transactions} ventas • {fmtMoney(salesAgg.topSeller.amount)}</div></>) : (<div className="text-slate-400 text-sm">Sin datos.</div>)}
                                        </div>
                                        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                                            <h5 className="font-semibold text-white mb-2">Mayor venta</h5>
                                            {salesAgg.largestSale ? (<><div className="text-white text-lg font-semibold">{fmtMoney(salesAgg.largestSale.amount)}</div><div className="text-slate-400 text-sm">{salesAgg.largestSale.seller} • {fmtDate(salesAgg.largestSale.date)}</div></>) : (<div className="text-slate-400 text-sm">Sin datos.</div>)}
                                        </div>
                                    </>
                                )}
                                {!isMulti && (
                                    <div className="bg-slate-700 rounded-lg p-4 border border-slate-600 flex items-center justify-between">
                                        <div className="text-slate-300"><div className="font-semibold text-white mb-1">Opciones de vista</div><div className="text-xs">Columna vendedor / Agrupar por vendedor</div></div>
                                        <div className="flex gap-4">
                                            <button onClick={() => setShowSellerCol((v) => !v)} className={`px-3 py-1.5 rounded-lg text-sm ${showSellerCol ? 'bg-orange-500 text-white' : 'bg-slate-600 text-slate-200'}`}>Vendedor</button>
                                            <button onClick={() => setGroupBySeller((v) => !v)} className={`px-3 py-1.5 rounded-lg text-sm ${groupBySeller ? 'bg-orange-500 text-white' : 'bg-slate-600 text-slate-200'}`}>Agrupar</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <LineCard title="Tendencia por Día" days={salesAgg.byDay.length} data={salesAgg.byDay} dataKey="amount" color="#f97316" />
                                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                                    <div className="flex items-center justify-between mb-2"><h5 className="font-semibold text-white">Ventas por Vendedor</h5><span className="text-slate-400 text-xs">{salesAgg.bySeller.length} vendedores</span></div>
                                    <div className="h-56">
                                        <ResponsiveContainer>
                                            <BarChart data={salesAgg.bySeller}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="seller" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <Tooltip formatter={(v: number) => fmtMoney(Number(v))} />
                                                <Legend />
                                                <Bar dataKey="amount" name="Monto" fill="#22c55e" />
                                                <Bar dataKey="transactions" name="Ventas" fill="#38bdf8" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <PieCard title="Top Productos (S/)" data={salesAgg.byProduct} colors={CHART_COLORS} />
                            </div>

                            {!isMulti && (
                                <>
                                    <h4 className="text-base sm:text-lg font-semibold text-white mt-4">Ventas Detalladas ({sales.length})</h4>
                                    {groupBySeller ? (
                                        <div className="space-y-6">
                                            {salesAgg.bySeller.map((v) => {
                                                const rows = sales.filter((s) => (s.seller ?? (s.user_id ? `Usuario #${s.user_id}` : '—')) === v.seller)
                                                return (
                                                    <div key={v.seller} className="bg-slate-700 rounded-lg border border-slate-600">
                                                        <div className="px-4 py-3 border-b border-slate-600 flex items-center justify-between">
                                                            <div className="text-white font-semibold">{v.seller}</div>
                                                            <div className="text-slate-300 text-sm">{v.transactions} ventas • {fmtMoney(v.amount)}</div>
                                                        </div>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-xs sm:text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-slate-700 text-[11px] sm:text-sm">
                                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Fecha/Hora</th>
                                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Producto</th>
                                                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Cantidad</th>
                                                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Precio Unit.</th>
                                                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Total</th>
                                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Pago</th>
                                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Cliente</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {rows.map((r, i) => (
                                                                        <tr key={`${r.sale_id}-${i}`} className="border-b border-slate-800 hover:bg-slate-700/50">
                                                                            <td className="py-3 px-4 text-slate-300"><div>{fmtDate(r.date)}</div><div className="text-[11px] sm:text-xs text-slate-500">{r.time}</div></td>
                                                                            <td className="py-3 px-4 text-white">{r.product_name ?? '—'}</td>
                                                                            <td className="py-3 px-4 text-right text-slate-300">{r.quantity ?? 0} L</td>
                                                                            <td className="py-3 px-4 text-right text-slate-300">{fmtMoney(r.unit_price ?? 0)}</td>
                                                                            <td className="py-3 px-4 text-right text-white font-medium">{fmtMoney(r.total_amount)}</td>
                                                                            <td className="py-3 px-4 text-slate-300">{r.payment_method ?? '—'}</td>
                                                                            <td className="py-3 px-4 text-slate-300">{r.client_name ?? 'Venta normal'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs sm:text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-700 text-[11px] sm:text-sm">
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Fecha/Hora</th>
                                                        {showSellerCol && <th className="text-left py-3 px-4 text-slate-300 font-medium">Vendedor</th>}
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Producto</th>
                                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Cantidad</th>
                                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Precio Unit.</th>
                                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Total</th>
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Pago</th>
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Cliente</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sales.map((r, i) => (
                                                        <tr key={`${r.sale_id}-${i}`} className="border-b border-slate-800 hover:bg-slate-700/40">
                                                            <td className="py-3 px-4 text-slate-300"><div>{fmtDate(r.date)}</div><div className="text-[11px] sm:text-xs text-slate-500">{r.time}</div></td>
                                                            {showSellerCol && <td className="py-3 px-4 text-white">{r.seller ?? (r.user_id ? `Usuario #${r.user_id}` : '—')}</td>}
                                                            <td className="py-3 px-4 text-white">{r.product_name ?? '—'}</td>
                                                            <td className="py-3 px-4 text-right text-slate-300">{r.quantity ?? 0} L</td>
                                                            <td className="py-3 px-4 text-right text-slate-300">{fmtMoney(r.unit_price ?? 0)}</td>
                                                            <td className="py-3 px-4 text-right text-white font-medium">{fmtMoney(r.total_amount)}</td>
                                                            <td className="py-3 px-4 text-slate-300">{r.payment_method ?? '—'}</td>
                                                            <td className="py-3 px-4 text-slate-300">{r.client_name ?? 'Venta normal'}</td>
                                                        </tr>
                                                    ))}
                                                    {!sales.length && (
                                                        <tr><td colSpan={showSellerCol ? 8 : 7} className="py-6 text-center text-slate-400">Sin ventas en el período seleccionado.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                            {isMulti && <div className="text-slate-400 text-sm">* En vista múltiple se muestran KPIs/gráficas agregadas (no hay tabla detallada).</div>}
                        </div>
                    )}

                    {activeTab === 'credits' && (
                        <div className="space-y-5">
                            {isMulti ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600"><div className="text-slate-400 text-sm">Total cobrado</div><div className="text-white text-2xl font-bold">{fmtMoney(kpis.totalCobranzas)}</div></div>
                                        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600"><div className="text-slate-400 text-sm">Créditos / Pagos</div><div className="text-white text-2xl font-bold">{kpis.cobranzasCount}</div></div>
                                        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600"><div className="text-slate-400 text-sm">Promedio por pago</div><div className="text-white text-2xl font-bold">{fmtMoney(kpis.cobranzasCount ? kpis.totalCobranzas / kpis.cobranzasCount : 0)}</div></div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600"><div className="text-slate-400 text-sm">Total cobrado</div><div className="text-white text-2xl font-bold">{fmtMoney(creditsAgg.total)}</div></div>
                                        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600"><div className="text-slate-400 text-sm">Pagos</div><div className="text-white text-2xl font-bold">{creditsAgg.count}</div></div>
                                        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600"><div className="text-slate-400 text-sm">Promedio por pago</div><div className="text-white text-2xl font-bold">{fmtMoney(creditsAgg.avg)}</div></div>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <LineCard title="Cobranzas por Día" days={creditsAgg.byDay.length} data={creditsAgg.byDay} dataKey="amount" color="#22c55e" />
                                        <PieCard title="Métodos de Pago" data={creditsAgg.byMethod} colors={CHART_COLORS} />
                                    </div>
                                    {!!createdCredits.length && (
                                        <div>
                                            <h4 className="text-base sm:text-lg font-semibold text-white mb-3">Créditos generados ({createdCredits.length})</h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs sm:text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-700 text-[11px] sm:text-sm">
                                                            <th className="text-left py-3 px-4 text-slate-300 font-medium">Fecha</th>
                                                            <th className="text-left py-3 px-4 text-slate-300 font-medium">Cliente</th>
                                                            <th className="text-right py-3 px-4 text-slate-300 font-medium">Total</th>
                                                            <th className="text-right py-3 px-4 text-slate-300 font-medium">Pagado</th>
                                                            <th className="text-right py-3 px-4 text-slate-300 font-medium">Saldo</th>
                                                            <th className="text-left py-3 px-4 text-slate-300 font-medium">Vence</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {createdCredits.map((c: any) => (
                                                            <tr key={c.credit_id} className="border-b border-slate-800 hover:bg-slate-700/50">
                                                                <td className="py-3 px-4 text-slate-300">{fmtDate(c.sale_timestamp)}</td>
                                                                <td className="py-3 px-4 text-white">{c.client_name}</td>
                                                                <td className="py-3 px-4 text-right text-slate-300">{fmtMoney(c.credit_amount)}</td>
                                                                <td className="py-3 px-4 text-right text-slate-300">{fmtMoney(c.amount_paid)}</td>
                                                                <td className="py-3 px-4 text-right text-slate-300">{fmtMoney(c.remaining_balance)}</td>
                                                                <td className="py-3 px-4 text-slate-300">{fmtDate(c.due_date)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-base sm:text-lg font-semibold text-white mb-3">Cobranzas ({credits.length})</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs sm:text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-700 text-[11px] sm:text-sm">
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Fecha</th>
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Cliente</th>
                                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Monto</th>
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Método</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {credits.map((c) => (
                                                        <tr key={c.payment_id} className="border-b border-slate-800 hover:bg-slate-700/50">
                                                            <td className="py-3 px-4 text-slate-300">{fmtDate(c.payment_date)}</td>
                                                            <td className="py-3 px-4 text-white">{c.client_name ?? '—'}</td>
                                                            <td className="py-3 px-4 text-right text-slate-300">{fmtMoney(c.amount)}</td>
                                                            <td className="py-3 px-4 text-slate-300">{c.payment_method ?? '—'}</td>
                                                        </tr>
                                                    ))}
                                                    {!credits.length && (
                                                        <tr><td colSpan={4} className="py-6 text-center text-slate-400">Sin cobranzas en el período seleccionado.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'inventory' && (
                        <div className="space-y-5">
                            {(() => {
                                const norm = (t: InventoryRow['movement_type']): 'in' | 'out' | 'adjust' => (t === 'Entrada' || t === 'in') ? 'in' : (t === 'Salida' || t === 'out') ? 'out' : 'adjust'
                                const trendMap = new Map<string, { entradas: number; salidas: number; ajustes: number }>()
                                const byTypeQty = new Map<'in' | 'out' | 'adjust', number>([['in', 0], ['out', 0], ['adjust', 0]])
                                const byTank = new Map<string, number>()
                                const byProd = new Map<string, number>()
                                for (const m of inventory) {
                                    const d = (m.movement_timestamp || '').substring(0, 10)
                                    const t = norm(m.movement_type)
                                    const qty = Number(m.quantity || 0)
                                    const prev = trendMap.get(d) || { entradas: 0, salidas: 0, ajustes: 0 }
                                    if (t === 'in') prev.entradas += qty; else if (t === 'out') prev.salidas += qty; else prev.ajustes += qty
                                    trendMap.set(d, prev)
                                    byTypeQty.set(t, (byTypeQty.get(t) || 0) + qty)
                                    if (m.tank_name) byTank.set(m.tank_name, (byTank.get(m.tank_name) || 0) + qty)
                                    if (m.product_name) byProd.set(m.product_name, (byProd.get(m.product_name) || 0) + qty)
                                }
                                const trend = Array.from(trendMap, ([date, v]) => ({ date, ...v })).sort((a, b) => (a.date < b.date ? -1 : 1))
                                const typePie = [{ name: 'Entradas', value: byTypeQty.get('in') || 0 }, { name: 'Salidas', value: byTypeQty.get('out') || 0 }, { name: 'Ajustes', value: byTypeQty.get('adjust') || 0 }]
                                const entradas = byTypeQty.get('in') || 0
                                const salidas = byTypeQty.get('out') || 0
                                const ajustes = byTypeQty.get('adjust') || 0
                                return (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-slate-700 rounded-lg p-4 border border-slate-600"><div className="text-slate-400 text-sm">Entradas</div><div className="text-white text-2xl font-bold">{entradas} L</div></div>
                                            <div className="bg-slate-700 rounded-lg p-4 border border-slate-600"><div className="text-slate-400 text-sm">Salidas</div><div className="text-white text-2xl font-bold">{salidas} L</div></div>
                                            <div className="bg-slate-700 rounded-lg p-4 border border-slate-600"><div className="text-slate-400 text-sm">Ajustes</div><div className="text-white text-2xl font-bold">{ajustes} L</div></div>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                                                <div className="flex items-center justify-between mb-2"><h5 className="font-semibold text-white">Distribución por Tipo (L)</h5><span className="text-slate-400 text-xs">{typePie.length} tipos</span></div>
                                                <div className="h-56">
                                                    <ResponsiveContainer>
                                                        <PieChart>
                                                            <Pie data={typePie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                                                                {typePie.map((d, i) => (
                                                                    <Cell key={i} fill={d.name === 'Entradas' ? '#22c55e' : d.name === 'Salidas' ? '#f97316' : '#a78bfa'} />
                                                                ))}
                                                            </Pie>
                                                            <Legend />
                                                            <Tooltip formatter={(v: number) => `${Number(v)} L`} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                            <div className="bg-slate-700 rounded-lg p-4 border border-slate-600 lg:col-span-2">
                                                <div className="flex items-center justify-between mb-2"><h5 className="font-semibold text-white">Movimientos por Día (L)</h5><span className="text-slate-400 text-xs">{trend.length} días</span></div>
                                                <div className="h-56">
                                                    <ResponsiveContainer>
                                                        <BarChart data={trend}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                            <Tooltip formatter={(v: number) => `${Number(v)} L`} labelFormatter={(d) => fmtDate(String(d))} />
                                                            <Legend />
                                                            <Bar dataKey="entradas" stackId="a" name="Entradas" fill="#22c55e" />
                                                            <Bar dataKey="salidas" stackId="a" name="Salidas" fill="#f97316" />
                                                            <Bar dataKey="ajustes" stackId="a" name="Ajustes" fill="#a78bfa" />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>
                                        <h4 className="text-base sm:text-lg font-semibold text-white">Movimientos de Inventario ({inventory.length})</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs sm:text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-700 text-[11px] sm:text-sm">
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Fecha/Hora</th>
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Producto</th>
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Tanque</th>
                                                        <th className="text-center py-3 px-4 text-slate-300 font-medium">Tipo</th>
                                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Cantidad</th>
                                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Motivo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {inventory.map((m, i) => (
                                                        <tr key={m.movement_id ?? i} className="border-b border-slate-800 hover:bg-slate-700/50">
                                                            <td className="py-3 px-4 text-slate-300"><div>{fmtDate(m.movement_timestamp || '')}</div><div className="text-[11px] sm:text-xs text-slate-500">{hhmm(m.movement_timestamp || '')}</div></td>
                                                            <td className="py-3 px-4 text-white">{m.product_name ?? '—'}</td>
                                                            <td className="py-3 px-4 text-slate-300">{m.tank_name ?? '—'}</td>
                                                            <td className="py-3 px-4 text-center text-slate-300 capitalize">{m.movement_type}</td>
                                                            <td className="py-3 px-4 text-right text-slate-300">{m.quantity} L</td>
                                                            <td className="py-3 px-4 text-slate-300">{m.reason ?? '—'}</td>
                                                        </tr>
                                                    ))}
                                                    {!inventory.length && (<tr><td colSpan={6} className="py-6 text-center text-slate-400">Sin movimientos en el período seleccionado.</td></tr>)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )
                            })()}
                        </div>
                    )}

                    {activeTab === 'shifts' && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="font-semibold text-white">Ventas por Turno (S/)</h5>
                                        <span className="text-slate-400 text-xs">{shifts.length} turnos</span>
                                    </div>
                                    <div className="h-56">
                                        <ResponsiveContainer>
                                            <BarChart data={shifts}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="shift_name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <Tooltip formatter={(v: number) => fmtMoney(Number(v))} />
                                                <Legend />
                                                <Bar dataKey="gross" name="Monto" fill="#22c55e" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="font-semibold text-white">Transacciones por Turno</h5>
                                        <span className="text-slate-400 text-xs">{shifts.length} turnos</span>
                                    </div>
                                    <div className="h-56">
                                        <ResponsiveContainer>
                                            <BarChart data={shifts}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="shift_name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="count" name="Ventas" fill="#38bdf8" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700 text-[11px] sm:text-sm">
                                            <th className="text-left py-3 px-4 text-slate-300 font-medium">Turno</th>
                                            <th className="text-right py-3 px-4 text-slate-300 font-medium">Ventas (#)</th>
                                            <th className="text-right py-3 px-4 text-slate-300 font-medium">Monto (S/)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shifts.map((s, i) => (
                                            <tr key={s.shift_id ?? s.shift_name ?? i} className="border-b border-slate-800 hover:bg-slate-700/40">
                                                <td className="py-3 px-4 text-white">{s.shift_name}</td>
                                                <td className="py-3 px-4 text-right text-slate-300">{s.count}</td>
                                                <td className="py-3 px-4 text-right text-white font-medium">{fmtMoney(s.gross)}</td>
                                            </tr>
                                        ))}
                                        {!shifts.length && (
                                            <tr><td colSpan={3} className="py-6 text-center text-slate-400">Sin datos de turnos para el período.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6">
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">Sistema de Reportes Grifosis</h3>
                    <p className="text-slate-400 text-sm">Versión 3.0 — hook + normalizadores + UI DRY</p>
                    <div className="mt-4 flex justify-center gap-x-6 gap-y-2 flex-wrap text-sm text-slate-500">
                        <span>• Ventas</span>
                        <span>• Créditos</span>
                        <span>• Inventario</span>
                        <span>• KPIs</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EmployeeDetailedReport