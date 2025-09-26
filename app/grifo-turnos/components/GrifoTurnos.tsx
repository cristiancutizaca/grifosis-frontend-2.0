'use client';
import React, { useEffect, useMemo, useState } from 'react';
// ⚠️ No importes TurnosContent aquí: este archivo ES TurnosContent

type ShiftName = 'Leon' | 'Tarde' | 'Buho';
type Producto = 'Regular' | 'Premium' | 'Diesel';

type VentaAPI = {
  sale_id: number | string;
  sale_timestamp: string;            // ISO
  status?: string;                   // 'completed' | 'anulada'...
  client_name?: string;
  pump_number?: number | string;     // si viene por join nozzle->pump
  nozzle_number?: number | string;   // opcional
  product_name?: string;             // 'Regular' | 'Premium' | 'Diesel'
  quantity?: number;                 // galones
  unit_price?: number;
  total_amount?: number;             // monto venta
  payment_method?: string;           // 'Efectivo'/'Tarjeta'/'Credito'
};

type VentasResponse = { items: VentaAPI[]; total: number };

const PAGE_SIZE = 10;

/* 1) Turnos (simple, sin tocar backend) */
const SHIFT_HOURS: Record<ShiftName, { start: string; end: string }> = {
  Leon:  { start: '05:00', end: '12:00' },
  Tarde: { start: '12:00', end: '19:00' },
  Buho:  { start: '19:00', end: '05:00' }, // cruza medianoche
};
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number); return h * 60 + m;
};
const inRange = (t: number, s: number, e: number) => (s <= e ? t >= s && t < e : t >= s || t < e);

function resolveShift(now = new Date()): { name: ShiftName; from: Date; to: Date } {
  const t = now.getHours() * 60 + now.getMinutes();
  for (const [name, { start, end }] of Object.entries(SHIFT_HOURS) as [ShiftName, { start: string; end: string }][]) {
    const s = toMin(start), e = toMin(end);
    if (inRange(t, s, e)) {
      const from = new Date(now), to = new Date(now);
      from.setHours(Math.floor(s / 60), s % 60, 0, 0);
      to.setHours(Math.floor(e / 60), e % 60, 0, 0);
      if (s > e && t < e) from.setDate(from.getDate() - 1); // inició ayer
      if (s > e && t >= s) to.setDate(to.getDate() + 1);    // termina mañana
      return { name, from, to };
    }
  }
  // fallback
  const from = new Date(now); from.setHours(5, 0, 0, 0);
  const to = new Date(now);   to.setHours(12, 0, 0, 0);
  return { name: 'Leon', from, to };
}

/* 2) Cliente API muy sencillo */
async function fetchVentasByRange(params: { from: string; to: string; page: number; pageSize: number }): Promise<VentasResponse> {
  const base = process.env.NEXT_PUBLIC_API_URL || '/api';
  const q = new URLSearchParams({
    from: params.from,
    to: params.to,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  // Ajusta la ruta si tu backend usa otra (por ejemplo /api/sales/list)
  const res = await fetch(`${base}/sales?${q.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error('No se pudo cargar ventas');
  return res.json();
}

/* 3) Componente */
export default function TurnosContent() {
  const [{ name: shiftName, from, to }, setShift] = useState(resolveShift());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ventas, setVentas] = useState<VentaAPI[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  // Recalcular turno cada minuto (por si cambia de Tarde a Búho)
  useEffect(() => {
    const id = setInterval(() => setShift(resolveShift()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fromISO = useMemo(() => from.toISOString(), [from]);
  const toISO   = useMemo(() => to.toISOString(),   [to]);

  async function load(n = page) {
    setLoading(true);
    try {
      const data = await fetchVentasByRange({ from: fromISO, to: toISO, page: n, pageSize: PAGE_SIZE });
      setVentas(data.items || []);
      setTotalRows(data.total || 0);
      setPage(n);
    } finally {
      setLoading(false);
    }
  }

  // Cargar al montar y cuando cambie el rango del turno
  useEffect(() => { load(1); }, [fromISO, toISO]); // eslint-disable-line react-hooks/exhaustive-deps

  // Totales para las 3 tarjetas (galones y soles)
  const totales = useMemo(() => {
    const base: Record<Producto, { gal: number; sol: number }> = {
      Regular: { gal: 0, sol: 0 },
      Premium: { gal: 0, sol: 0 },
      Diesel:  { gal: 0, sol: 0 },
    };
    for (const v of ventas) {
      const prod = (v.product_name || 'Regular') as Producto;
      const q = Number(v.quantity ?? 0);
      const total = Number(v.total_amount ?? (q * Number(v.unit_price ?? 0)));
      if (prod in base) {
        base[prod as Producto].gal += q;
        base[prod as Producto].sol += total;
      }
    }
    return base;
  }, [ventas]);

  // ✅ te faltaba esto
  const totalPaginas = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Encabezado: turno activo y actualizar */}
      <div className="bg-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="text-white text-xl font-bold">TURNO ACTIVO: <span className="ml-2 bg-blue-600 px-3 py-1 rounded-lg">{shiftName}</span></div>
          <button onClick={() => load(page)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded">
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Tarjeta VENTAS */}
      <div className="bg-gray-800 rounded-2xl p-6">
        <h2 className="text-white text-2xl font-bold mb-6 text-center">VENTAS</h2>
        <div className="border-t border-gray-600 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Regular */}
            <div className="text-center">
              <div className="bg-red-500 rounded-2xl h-32 flex items-center justify-center mb-2">
                <div className="text-white">
                  <div className="text-2xl font-bold">{totales.Regular.gal.toFixed(0)}</div>
                  <div className="text-sm">GAL</div>
                </div>
              </div>
            </div>
            {/* Premium */}
            <div className="text-center">
              <div className="bg-green-500 rounded-2xl h-32 flex items-center justify-center mb-2">
                <div className="text-white">
                  <div className="text-2xl font-bold">{totales.Premium.gal.toFixed(0)}</div>
                  <div className="text-sm">GAL</div>
                </div>
              </div>
            </div>
            {/* Diesel */}
            <div className="text-center">
              <div className="bg-purple-500 rounded-2xl h-32 flex items-center justify-center mb-2">
                <div className="text-white">
                  <div className="text-2xl font-bold">{totales.Diesel.gal.toFixed(0)}</div>
                  <div className="text-sm">GAL</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detalle soles por producto */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-red-400 font-bold">REGULAR</span>
              <span className="text-white font-bold">S/ {totales.Regular.sol.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-green-400 font-bold">PREMIUM</span>
              <span className="text-white font-bold">S/ {totales.Premium.sol.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-purple-400 font-bold">DIESEL</span>
              <span className="text-white font-bold">S/ {totales.Diesel.sol.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ventas recientes */}
      <div className="bg-gray-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white text-2xl font-bold">Ventas recientes</h2>
          <div className="text-slate-300 text-sm">
            Rango: {from.toLocaleString()} — {to.toLocaleString()}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-4 md:grid-cols-5 gap-4 text-gray-400 text-sm font-bold">
            <div>CLIENTE / SURTIDOR</div>
            <div className="hidden md:block">PRODUCTO</div>
            <div>MONTO</div>
            <div className="hidden md:block">FECHA</div>
            <div>ESTADO</div>
          </div>

          {ventas.map((v) => {
            const cliente  = v.client_name || 'Cliente';
            const surtidor = v.pump_number ? `Surtidor ${String(v.pump_number).padStart(3, '0')}` : 'Surtidor';
            const prodLine = `${v.product_name ?? '—'} · ${(Number(v.quantity ?? 0)).toFixed(2)} gal`;
            const monto    = Number(v.total_amount ?? (Number(v.quantity ?? 0) * Number(v.unit_price ?? 0)));
            const fecha    = new Date(v.sale_timestamp).toLocaleString();
            const ok       = (v.status || '').toLowerCase() === 'completed' || (v.status || '').toLowerCase() === 'completada';

            return (
              <div key={v.sale_id} className="grid grid-cols-4 md:grid-cols-5 gap-4 text-white border-t border-slate-700 py-3">
                <div>
                  <div className="font-semibold">{cliente}</div>
                  <div className="text-xs text-slate-400">{surtidor}</div>
                </div>
                <div className="hidden md:block">{prodLine}</div>
                <div className="text-green-400 font-bold">S/ {monto.toFixed(2)}</div>
                <div className="hidden md:block text-slate-300">{fecha}</div>
                <div>
                  <span className={`px-2 py-1 rounded text-xs ${ok ? 'bg-green-700' : 'bg-slate-600'}`}>
                    {ok ? 'Completada' : (v.status ?? '—')}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Paginación */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              disabled={page <= 1}
              onClick={() => page > 1 && load(page - 1)}
              className={`px-3 py-1 rounded ${page <= 1 ? 'bg-slate-800 text-slate-500' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
            >
              ◀ Anterior
            </button>
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map(n => (
              <button
                key={n}
                onClick={() => load(n)}
                className={`px-3 py-1 rounded ${n === page ? 'bg-orange-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
              >
                {n}
              </button>
            ))}
            <button
              disabled={page >= totalPaginas}
              onClick={() => page < totalPaginas && load(page + 1)}
              className={`px-3 py-1 rounded ${page >= totalPaginas ? 'bg-slate-800 text-slate-500' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
            >
              Siguiente ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
