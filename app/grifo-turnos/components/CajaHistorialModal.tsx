'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, LogIn, LogOut, Clock, CalendarDays, User, RefreshCcw } from 'lucide-react';
import cashBoxService from './../../../src/services/cashBoxService';

/* ================= Tipos que se exportan para otros componentes ================= */
export type CajaEvent =
  | {
      type: 'open';
      by: string;
      amount?: number;          // monto inicial
      timestamp: string | Date; // ISO o Date
      shift: string;
      notes?: string;
    }
  | {
      type: 'close';
      by: string;
      sales?: number;           // ventas del turno
      totalInCash?: number;     // total en caja al cerrar
      timestamp: string | Date; // ISO o Date
      shift: string;
      notes?: string;
    };

export type CajaHistoryDay = {
  dateKey: string; // YYYY-MM-DD
  events: CajaEvent[];
};

/* ================= Utilidades ================= */
const fmtMoney = (n?: number) => `S/ ${(Number(n || 0)).toFixed(2)}`;
const ymd = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Helpers robustos para fechas (eventos)
const toSafeDate = (ts: string | Date) => {
  if (ts instanceof Date) return ts;
  const s = String(ts || '');
  // Postgres: "YYYY-MM-DD HH:mm:ss.sss-05" -> reemplazar ' ' por 'T' para que el parser sea estándar
  const isoLike = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(isoLike);
  return isNaN(d.getTime()) ? new Date(s) : d;
};

// Encabezado del día: forzar siempre DD/MM/YYYY aunque dateKey venga en ISO con hora
const formatHeaderDate = (key: string) => {
  const ymdStr = String(key || '').slice(0, 10); // fuerza "YYYY-MM-DD"
  const [y, m, d] = ymdStr.split('-').map(Number);
  if (!y || !m || !d) return ymdStr || '—';
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

type Props = {
  open: boolean;
  onClose: () => void;
  // Nota: NO acepta `history` por props. El modal carga su propio historial por rango.
};

const CajaHistorialModal: React.FC<Props> = ({ open, onClose }) => {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState<string>(ymd(addDays(today, -7))); // por defecto: últimos 7 días
  const [to, setTo] = useState<string>(ymd(today));
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<CajaHistoryDay[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Carga por rango usando el servicio (incluye fallbacks internos)
  const loadRange = async (startYMD: string, endYMD: string) => {
    setLoading(true);
    setError(null);
    try {
      const days = await cashBoxService.getHistoryRange({ from: startYMD, to: endYMD });
      // Asegurar orden descendente por día
      days.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
      setHistory(days);
    } catch (e) {
      setError('No se pudo cargar el historial.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadRange(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSearch = () => loadRange(from, to);
  const quick = {
    hoy: () => {
      const t = ymd(new Date());
      setFrom(t);
      setTo(t);
      loadRange(t, t);
    },
    ayer: () => {
      const y = ymd(addDays(new Date(), -1));
      setFrom(y);
      setTo(y);
      loadRange(y, y);
    },
    d7: () => {
      const t = ymd(new Date());
      const f = ymd(addDays(new Date(), -7));
      setFrom(f);
      setTo(t);
      loadRange(f, t);
    },
    d30: () => {
      const t = ymd(new Date());
      const f = ymd(addDays(new Date(), -30));
      setFrom(f);
      setTo(t);
      loadRange(f, t);
    },
  };

  if (!open) return null;

  const days = history;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-[101] max-h-[86vh] w-[min(100%,980px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0B1220] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 p-4">
          <h3 className="text-base font-semibold text-white">Historial completo de caja</h3>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Controles de rango */}
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-300">Desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md bg-slate-800/50 p-2 text-sm text-white outline-none"
            />
            <label className="ml-3 text-xs text-slate-300">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md bg-slate-800/50 p-2 text-sm text-white outline-none"
            />
            <button
              onClick={onSearch}
              className="ml-3 rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-white hover:bg-slate-700"
            >
              Buscar
            </button>
            <button
              onClick={() => loadRange(from, to)}
              className="ml-2 rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-white hover:bg-slate-700"
              title="Recargar"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={quick.hoy} className="rounded-full bg-slate-800/70 px-3 py-1 text-xs text-white hover:bg-slate-700">Hoy</button>
            <button onClick={quick.ayer} className="rounded-full bg-slate-800/70 px-3 py-1 text-xs text-white hover:bg-slate-700">Ayer</button>
            <button onClick={quick.d7} className="rounded-full bg-slate-800/70 px-3 py-1 text-xs text-white hover:bg-slate-700">Últimos 7</button>
            <button onClick={quick.d30} className="rounded-full bg-slate-800/70 px-3 py-1 text-xs text-white hover:bg-slate-700">Últimos 30</button>
          </div>
        </div>

        {/* Contenido */}
        <div className="max-h-[66vh] overflow-y-auto p-4">
          {loading && (
            <div className="py-10 text-center text-slate-400">Cargando historial…</div>
          )}
          {!loading && error && (
            <div className="py-10 text-center text-rose-400">{error}</div>
          )}
          {!loading && !error && days.length === 0 && (
            <div className="py-10 text-center text-slate-400">Sin datos en el rango.</div>
          )}

          {!loading && !error && days.map((day) => (
            <section key={day.dateKey} className="mb-6 rounded-xl border border-white/10 bg-slate-900/40">
              <div className="flex items-center gap-2 border-b border-white/10 p-3">
                <CalendarDays className="h-4 w-4 text-orange-300" />
                <h4 className="text-sm font-semibold text-white">
                  {formatHeaderDate(day.dateKey)}
                </h4>
              </div>

              <div className="divide-y divide-white/10">
                {day.events.map((ev, idx) => {
                  const dt = toSafeDate(ev.timestamp);
                  const hora = dt.toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-6 sm:items-center"
                    >
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-slate-800/80 p-2">
                          {ev.type === 'open' ? (
                            <LogIn className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <LogOut className="h-4 w-4 text-rose-400" />
                          )}
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {ev.type === 'open' ? 'Apertura' : 'Cierre'} · {/^\s*tarde\s*$/i.test(ev.shift) ? 'Lobo' : ev.shift}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <User className="h-4 w-4 text-slate-400" />
                        {ev.by || '—'}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Clock className="h-4 w-4 text-slate-400" />
                        {hora}
                      </div>

                      <div className="text-sm text-slate-300">
                        {ev.type === 'open' ? (
                          <>
                            Monto inicial{' '}
                            <span className="font-semibold text-white">{fmtMoney(ev.amount)}</span>
                          </>
                        ) : (
                          <>
                            Ventas{' '}
                            <span className="font-semibold text-white">{fmtMoney(ev.sales)}</span>
                          </>
                        )}
                      </div>

                      <div className="text-sm text-slate-300">
                        {ev.type === 'close' && ev.totalInCash !== undefined && (
                          <>
                            Total en caja{' '}
                            <span className="font-semibold text-white">
                              {fmtMoney(ev.totalInCash)}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="text-right text-xs text-slate-400">
                        {dt.toLocaleDateString('es-PE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </div>

                      {ev.notes && (
                        <div className="sm:col-span-6 mt-1 text-xs text-slate-400">
                          Obs.: {ev.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CajaHistorialModal;
