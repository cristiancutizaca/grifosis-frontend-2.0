'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import 'chart.js/auto';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Users, TrendingUp, FileText, Search, AlertCircle, Loader2 } from 'lucide-react';

import {
  searchClients,
  getClientSalesSummary,
  getClientSalesDetail,
  type ClientSuggestion,
  type ClientSummaryRow,
  type ClientDetailRow,
  type GroupKind,
  downloadClientDetailExcel,
  downloadClientSummaryExcel,
} from './../../../src/components/clientReportsService';

// ====== helpers de fecha ======
function pad(n: number) {
  return String(n).padStart(2, '0');
}
function isoLocal(d: Date) {
  // yyyy-MM-ddTHH:mm (lo que espera input[type=datetime-local])
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}
function startOfMonthISO() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return isoLocal(d);
}
function nextMonthStartISO() {
    const d = new Date();
    // Ir al primer día del mes actual
    d.setDate(1);
    d.setHours(23, 59, 59, 999); // Final del día
    // Avanzar al siguiente mes
    d.setMonth(d.getMonth() + 1);
    // El resultado es el último momento del último día del mes actual
    return isoLocal(d);
}
function fmtMoney(x: number) {
  return x.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });
}
function fmtGallons(x: number) {
  return x.toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function toLocalDateStr(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  // Ajustar por la zona horaria para mostrar la fecha correcta
  const userTimezoneOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() + userTimezoneOffset).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// ====== componente principal ======
export default function ClientReports() {
  const router = useRouter();
  // búsqueda de cliente
  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [selected, setSelected] = useState<ClientSuggestion | null>(null);
  const [openSug, setOpenSug] = useState(false);
  const [searching, setSearching] = useState(false);

  // filtros
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(nextMonthStartISO());
  const [view, setView] = useState<'summary' | 'detail'>('summary');
  const [group, setGroup] = useState<GroupKind>('day');

  // data
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ClientSummaryRow[]>([]);
  const [detail, setDetail] = useState<ClientDetailRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // buscar con debounce
  useEffect(() => {
    const q = term.trim();
    if (!q || (selected && q === selected.label)) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchClients(q);
        setSuggestions(rows);
        setOpenSug(true);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term, selected]);

  // ejecutar consulta
  async function runQuery() {
    setError(null);
    setSummary([]);
    setDetail([]);
    if (!selected) {
      setError('Por favor, selecciona un cliente antes de generar el reporte.');
      return;
    }
    setLoading(true);
    try {
      if (view === 'summary') {
        const rows = await getClientSalesSummary(selected.client_id, from + ':00', to + ':00', group);
        setSummary(rows ?? []);
      } else {
        const rows = await getClientSalesDetail(selected.client_id, from + ':00', to + ':00');
        setDetail(rows ?? []);
      }
    } catch (e: any) {
      setError(e?.message || 'Ocurrió un error al consultar los datos del cliente.');
    } finally {
      setLoading(false);
    }
  }

  // totales (summary)
  const totals = useMemo(() => {
    if (view !== 'summary' || summary.length === 0) return null;
    return summary.reduce(
      (acc, r) => ({
        sales: acc.sales + (Number(r.sales) || 0),
        gallons: acc.gallons + (Number(r.gallons) || 0),
        revenue: acc.revenue + (Number(r.revenue) || 0),
        revCredit: acc.revCredit + (Number(r.revenue_credit) || 0),
        revCash: acc.revCash + (Number(r.revenue_cash) || 0),
      }),
      { sales: 0, gallons: 0, revenue: 0, revCredit: 0, revCash: 0 }
    );
  }, [summary, view]);

  // ====== CHARTS (para resumen) ======
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#cbd5e1' } },
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
    },
  };

  const chartLineData = useMemo(() => {
    if (view !== 'summary' || summary.length === 0) return null;
    return {
      labels: summary.map((r) => toLocalDateStr(r.period)),
      datasets: [{ label: 'Ingreso (S/)', data: summary.map((r) => Number(r.revenue) || 0), borderColor: '#38bdf8', backgroundColor: '#38bdf833', fill: true, tension: 0.3 }],
    };
  }, [summary, view]);

  const chartBarData = useMemo(() => {
    if (view !== 'summary' || summary.length === 0) return null;
    return {
      labels: summary.map((r) => toLocalDateStr(r.period)),
      datasets: [{ label: 'Galones', data: summary.map((r) => Number(r.gallons) || 0), backgroundColor: '#4ade80' }],
    };
  }, [summary, view]);

  const chartDonutData = useMemo(() => {
    if (view !== 'summary' || !totals || (totals.revCredit === 0 && totals.revCash === 0)) return null;
    return {
      labels: ['Crédito', 'Contado'],
      datasets: [{ data: [totals.revCredit, totals.revCash], backgroundColor: ['#f87171', '#fbbf24'] }],
    };
  }, [totals, view]);

  const hasResults = (view === 'summary' && summary.length > 0) || (view === 'detail' && detail.length > 0);

  
  async function downloadExcel() {
    if (!selected) {
      alert('Selecciona un cliente primero.');
      return;
    }
    const fromParam = from + ':00';
    const toParam = to + ':00';
    try {
      if (view === 'summary') {
        await downloadClientSummaryExcel(selected.client_id, fromParam, toParam, group);
      } else {
        await downloadClientDetailExcel(selected.client_id, fromParam, toParam);
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'No se pudo descargar el Excel');
    }
  }
// ====== UI ======
  return (
    <main className="max-w-screen-xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-5 md:py-6 space-y-6 overflow-x-hidden">
        {/* Header */}
        <header className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl shadow-2xl border border-slate-700 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center">
                        <Users className="mr-3 md:mr-4 h-7 w-7 md:h-8 md:w-8 text-sky-400" />
                        <span className="text-balance">Reportes por Cliente</span>
                    </h1>
                    <p className="text-slate-300 text-base md:text-lg">
                        Análisis del historial de consumo y créditos por cliente.
                    </p>
                </div>
                <div className="flex-shrink-0">
                    <button
                        onClick={() => router.push('/grifo-reportes')}
                        className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 text-left hover:bg-orange-500/20 transition-colors w-full sm:w-auto"
                    >
                        <div className="flex items-center text-orange-400 mb-1 md:mb-2">
                            <TrendingUp className="mr-2 h-5 w-5" />
                            <span className="font-semibold">Ir a Reportes por Usuario</span>
                        </div>
                        <p className="text-sm text-slate-300">Análisis detallado por vendedor</p>
                    </button>
                </div>
            </div>
        </header>

        {/* Intro cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-5 md:p-6 min-w-0">
                <div className="flex items-center mb-3 md:mb-4">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-400 mr-3" />
                <h3 className="text-base md:text-lg font-semibold text-white">Selección de Cliente</h3>
                </div>
                <p className="text-slate-300 text-sm">
                Busca y elige un cliente para generar un reporte detallado.
                </p>
            </div>
            <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-5 md:p-6 min-w-0">
                <div className="flex items-center mb-3 md:mb-4">
                <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-green-400 mr-3" />
                <h3 className="text-base md:text-lg font-semibold text-white">Historial de Consumo</h3>
                </div>
                <p className="text-slate-300 text-sm">
                Visualiza todas las ventas, productos comprados y montos totales.
                </p>
            </div>
            <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-5 md:p-6 min-w-0">
                <div className="flex items-center mb-3 md:mb-4">
                <FileText className="h-5 w-5 md:h-6 md:w-6 text-purple-400 mr-3" />
                <h3 className="text-base md:text-lg font-semibold text-white">Exportación Rápida</h3>
                </div>
                <p className="text-slate-300 text-sm">
                Genera un PDF o Excel con el resumen del cliente seleccionado.
                </p>
            </div>
        </section>
        
        {/* Filtros */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 md:p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                {/* buscador */}
                <div className="lg:col-span-4 relative">
                <label className="block text-sm font-medium text-slate-300 mb-2">1. Buscar cliente</label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        value={term}
                        onChange={(e) => {
                            setTerm(e.target.value);
                            setOpenSug(true);
                            if (selected && e.target.value !== selected.label) {
                                setSelected(null); // Deseleccionar si el texto cambia
                            }
                        }}
                        placeholder="Buscar por nombre o DNI..."
                        className="w-full rounded-md bg-slate-800 border border-slate-600 pl-10 pr-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                {/* sugerencias */}
                {openSug && term.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
                    {suggestions.map((s) => (
                        <button
                        key={`${s.client_id}-${s.label}`}
                        type="button"
                        onClick={() => {
                            setSelected(s);
                            setTerm(s.label);
                            setOpenSug(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm"
                        >
                        <div className="font-medium text-slate-200">{s.label}</div>
                        <div className="text-xs text-slate-400">ID: {s.client_id} {s.document_number && `• DNI/RUC: ${s.document_number}`}</div>
                        </button>
                    ))}
                    {searching && <div className="px-3 py-2 text-xs text-slate-400 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Buscando...</div>}
                    {!searching && suggestions.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No se encontraron clientes.</div>}
                    </div>
                )}
                </div>

                {/* fechas */}
                <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">2. Desde</label>
                    <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)}
                        className="w-full rounded-md bg-slate-800 border border-slate-600 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">3. Hasta</label>
                    <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)}
                        className="w-full rounded-md bg-slate-800 border border-slate-600 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* vista y agrupación */}
                <div className="lg:col-span-4 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">4. Vista</label>
                        <div className="flex gap-1 bg-slate-900 p-1 rounded-md">
                            <button type="button" onClick={() => setView('summary')} className={`flex-1 text-sm rounded px-2 py-1.5 ${view === 'summary' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Resumen</button>
                            <button type="button" onClick={() => setView('detail')} className={`flex-1 text-sm rounded px-2 py-1.5 ${view === 'detail' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Detalle</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Agrupar por</label>
                        <select
                            disabled={view !== 'summary'}
                            value={group}
                            onChange={(e) => setGroup(e.target.value as GroupKind)}
                            className="w-full rounded-md bg-slate-800 border border-slate-600 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            <option value="day">Día</option>
                            <option value="week">Semana</option>
                            <option value="month">Mes</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Fila de acción */}
            <div className="border-t border-slate-700 pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className='text-sm text-slate-400'>
                    {selected ? (
                        <span>Cliente seleccionado: <b className='text-white'>{selected.label}</b> (ID: {selected.client_id})</span>
                    ) : (
                        <span>Selecciona un cliente para continuar.</span>
                    )}
                </div>
                <button
                    onClick={runQuery}
                    disabled={!selected || loading}
                    className="w-full md:w-auto rounded-md bg-orange-500 hover:bg-orange-600 px-6 py-2.5 text-white font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Generando...</> : 'Generar Reporte'}
                </button>
                <button
                    onClick={downloadExcel}
                    disabled={!selected || loading}
                    className="w-full md:w-auto rounded-md bg-green-600 hover:bg-green-700 text-white px-4 py-2 font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Excel
                </button>

            </div>
        </div>

        {/* errores */}
        {error && <div className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-red-300 text-sm flex items-center gap-3"><AlertCircle className='h-5 w-5'/> {error}</div>}
        
        {/* Guía inicial */}
        {!selected && !error && !hasResults && (
            <section className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 md:p-6">
                <div className="flex items-start md:items-center gap-3">
                    <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-blue-400 mt-0.5 md:mt-0" />
                    <div>
                    <h3 className="text-base md:text-lg font-semibold text-blue-400 mb-1">Comienza tu Análisis</h3>
                    <p className="text-slate-300 text-sm">Para empezar, busca y selecciona un cliente, ajusta las fechas y haz clic en "Generar Reporte".</p>
                    </div>
                </div>
            </section>
        )}
        
        {/* RESULTADOS */}
        {hasResults && (
            <div className="space-y-6">
            {/* RESUMEN */}
            {view === 'summary' && summary.length > 0 && totals && (
                <div className="space-y-6">
                    <div className="overflow-auto rounded-lg border border-slate-700 bg-slate-800/20">
                        <table className="min-w-[700px] w-full text-sm">
                        <thead className="bg-slate-800 text-slate-300">
                            <tr>
                            <th className="px-4 py-3 text-left font-semibold">Periodo</th>
                            <th className="px-4 py-3 text-right font-semibold">Ventas (#)</th>
                            <th className="px-4 py-3 text-right font-semibold">Galones</th>
                            <th className="px-4 py-3 text-right font-semibold">Ingreso Total</th>
                            <th className="px-4 py-3 text-right font-semibold">Crédito</th>
                            <th className="px-4 py-3 text-right font-semibold">Contado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {summary.map((r) => (
                            <tr key={`${r.client_id}-${r.period}`} className='hover:bg-slate-800/40'>
                                <td className="px-4 py-2.5 whitespace-nowrap">{toLocalDateStr(r.period)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">{Number(r.sales) || 0}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">{fmtGallons(Number(r.gallons) || 0)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-white">{fmtMoney(Number(r.revenue) || 0)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-red-400">{fmtMoney(Number(r.revenue_credit) || 0)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-amber-400">{fmtMoney(Number(r.revenue_cash) || 0)}</td>
                            </tr>
                            ))}
                            <tr className="bg-slate-900/50 font-semibold text-white">
                            <td className="px-4 py-3">Totales</td>
                            <td className="px-4 py-3 text-right tabular-nums">{totals.sales}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{fmtGallons(totals.gallons)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-lg">{fmtMoney(totals.revenue)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-red-300">{fmtMoney(totals.revCredit)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-amber-300">{fmtMoney(totals.revCash)}</td>
                            </tr>
                        </tbody>
                        </table>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3 rounded-lg border border-slate-700 p-4 bg-slate-800/20"><div className="text-slate-300 text-sm mb-2 font-semibold">Ingreso por periodo</div><div className='h-64'>{chartLineData && <Line data={chartLineData} options={chartOptions} />}</div></div>
                        <div className="lg:col-span-2 rounded-lg border border-slate-700 p-4 bg-slate-800/20"><div className="text-slate-300 text-sm mb-2 font-semibold">Galones por periodo</div><div className='h-64'>{chartBarData && <Bar data={chartBarData} options={chartOptions} />}</div></div>
                        <div className="lg:col-span-5 rounded-lg border border-slate-700 p-4 bg-slate-800/20 flex flex-col md:flex-row items-center justify-center gap-6">
                            <div className="text-center"><div className="text-slate-300 text-sm mb-2 font-semibold">Crédito vs Contado</div><div className='h-48 w-48 mx-auto'>{chartDonutData ? <Doughnut data={chartDonutData} options={{...chartOptions, plugins: {legend: {position: 'bottom'}}}} /> : <div className="text-slate-500 h-full flex items-center justify-center">Sin datos</div>}</div></div>
                            <div className='space-y-4'>
                                <div className='bg-slate-900/50 p-4 rounded-lg text-center'><div className='text-slate-400 text-sm'>Total Ingreso</div><div className='text-2xl font-bold text-white tabular-nums'>{fmtMoney(totals.revenue)}</div></div>
                                <div className='bg-slate-900/50 p-4 rounded-lg text-center'><div className='text-slate-400 text-sm'>Total Galones</div><div className='text-2xl font-bold text-white tabular-nums'>{fmtGallons(totals.gallons)}</div></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* DETALLE */}
            {view === 'detail' && detail.length > 0 && (
                <div className="overflow-auto rounded-lg border border-slate-700 bg-slate-800/20">
                <table className="min-w-[1000px] w-full text-sm">
                    <thead className="bg-slate-800 text-slate-300">
                    <tr>
                        <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                        <th className="px-4 py-3 text-left font-semibold">Producto</th>
                        <th className="px-4 py-3 text-right font-semibold">Galones</th>
                        <th className="px-4 py-3 text-right font-semibold">P. Unit</th>
                        <th className="px-4 py-3 text-right font-semibold">Subtotal</th>
                        <th className="px-4 py-3 text-left font-semibold">Método Pago</th>
                        <th className="px-4 py-3 text-center font-semibold">Es Crédito</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                    {detail.map((r) => (
                        <tr key={r.sale_id + '-' + r.product_id} className='hover:bg-slate-800/40'>
                        <td className="px-4 py-2.5 whitespace-nowrap">{toLocalDateStr(r.sale_timestamp)}</td>
                        <td className="px-4 py-2.5">{r.product_name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtGallons(Number(r.gallons) || 0)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(Number(r.unit_price) || 0)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-white">{fmtMoney(Number(r.subtotal) || 0)}</td>
                        <td className="px-4 py-2.5">{r.payment_method}</td>
                        <td className="px-4 py-2.5 text-center">{r.is_credit ? <span className='bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full text-xs'>Sí</span> : 'No'}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            )}
            </div>
        )}

        {/* Mensaje de no resultados */}
        {!loading && !error && !hasResults && selected && (
             <div className="rounded-md border border-slate-700 bg-slate-800/30 px-4 py-10 text-center text-slate-400">
                <p className="font-semibold text-lg text-slate-300 mb-2">No se encontraron resultados</p>
                <p>El cliente <span className='font-bold text-white'>{selected.label}</span> no tiene registros de ventas para el período seleccionado.</p>
             </div>
        )}

        {/* Footer */}
        <footer className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6 mt-8">
            <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-2">Sistema de Reportes Grifosis</h3>
            <p className="text-slate-400 text-sm">Versión 3.0 — Análisis por cliente</p>
            </div>
        </footer>
    </main>
  );
}

