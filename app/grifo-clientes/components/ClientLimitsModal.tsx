// app/grifo-clientes/components/ClientLimitsModal.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  listClientLimits,
  upsertClientLimit,
  setClientLimitActive,
  deleteClientLimit,
  getClientLimitUsage,
  type ClientLimitRow,
  type PeriodKind,
} from '../../../src/services/clientLimitsService';
import { X, Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight, Pencil } from 'lucide-react';

type Product = { product_id: number; name: string };

type Props = {
  clientId: number;
  clientName?: string;
  products: Product[];
  onClose: () => void;
};

function toRows(r: any): ClientLimitRow[] {
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.rows)) return r.rows;
  if (Array.isArray(r?.data)) return r.data;
  if (Array.isArray(r?.items)) return r.items;
  return [];
}

export default function ClientLimitsModal({ clientId, clientName, products, onClose }: Props) {
  const [limits, setLimits] = useState<ClientLimitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productId, setProductId] = useState<number | ''>('');
  const [period, setPeriod] = useState<PeriodKind>('month');
  const [max, setMax] = useState<number>(0);
  const [allPayments, setAllPayments] = useState<boolean>(true);

  const productNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of products) m.set(p.product_id, p.name);
    return m;
  }, [products]);

  const load = async () => {
    try {
      setLoading(true);
      const resp = await listClientLimits(clientId);
      setLimits(toRows(resp));
    } catch (e: any) {
      setError(e.message || 'Error al cargar límites');
      setLimits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [clientId]);

  const onSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!productId || max <= 0) return;
    try {
      setSaving(true);
      await upsertClientLimit(clientId, Number(productId), {
        periodKind: period,
        maxGallons: Number(max),
        applyToAllPayments: allPayments,
        isActive: true,
      });
      await load();
      setProductId('');
      setPeriod('month');
      setMax(0);
      setAllPayments(true);
    } catch (e: any) {
      alert(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: ClientLimitRow) => {
    await setClientLimitActive(row.clientId, row.productId, !row.isActive, row.periodKind as PeriodKind);
    await load();
  };

  const handleDelete = async (row: ClientLimitRow) => {
    if (!confirm('¿Desactivar este límite?')) return;
    await deleteClientLimit(row.clientId, row.productId, row.periodKind as PeriodKind);
    await load();
  };

  const handleEditRow = (row: ClientLimitRow) => {
    setProductId(row.productId);
    setPeriod(row.periodKind as PeriodKind);
    setMax(Number(row.maxGallons || 0));
    setAllPayments(!!row.applyToAllPayments);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full h-[92vh] md:h-auto md:max-h-[85vh] md:rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl max-w-screen-xl flex flex-col"
      >
        {/* Header con título y botones */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
          <h3 className="text-sm sm:text-base font-semibold">
            Límites de cliente — {clientName ?? `ID ${clientId}`} {clientName ? `(ID ${clientId})` : ''}
          </h3>
          <div className="flex items-center gap-2">
            <button
              disabled={saving || !productId || max <= 0}
              onClick={onSubmit}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 h-9 text-sm text-white disabled:opacity-60"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Guardar / Actualizar</span>
              <span className="sm:hidden">Guardar</span>
            </button>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-md bg-slate-800 hover:bg-slate-700 px-3 h-9 text-sm text-slate-100"
              title="Refrescar"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-600"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="px-4 pb-4 overflow-y-auto">
          {/* Form compacto */}
          <form onSubmit={onSubmit} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-4">
                <label className="text-[11px] text-slate-400 block mb-1">Producto</label>
                <select
                  className="w-full h-9 bg-slate-950 border border-slate-700 rounded-md px-2 text-sm"
                  value={productId}
                  onChange={(e) => setProductId(Number(e.target.value))}
                >
                  <option value="">Producto…</option>
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] text-slate-400 block mb-1">Período</label>
                <select
                  className="w-full h-9 bg-slate-950 border border-slate-700 rounded-md px-2 text-sm"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as PeriodKind)}
                >
                  <option value="day">Día</option>
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] text-slate-400 block mb-1">Máx. galones</label>
                <input
                  type="number"
                  min={0.001}
                  step="0.001"
                  placeholder="Máx. galones"
                  className="w-full h-9 bg-slate-950 border border-slate-700 rounded-md px-2 text-sm"
                  value={max === 0 ? '' : max}
                  onChange={(e) => {
                    const v = e.target.value.replace(',', '.');
                    setMax(v === '' ? 0 : Number(v));
                  }}
                />
              </div>

              <div className="md:col-span-2 flex items-center">
                <label className="inline-flex items-center gap-2 text-slate-200 whitespace-nowrap truncate">
                  <input type="checkbox" checked={allPayments} onChange={(e) => setAllPayments(e.target.checked)} />
                  <span className="text-sm">Todas las formas de pago</span>
                </label>
              </div>
            </div>
          </form>

          {/* Tabla */}
          <div className="rounded-lg border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead className="bg-slate-800/80 text-slate-300 sticky top-0 z-[1]">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs">Producto</th>
                    <th className="px-3 py-2 text-center text-xs">Período</th>
                    <th className="px-3 py-2 text-right text-xs">Máx. Gal</th>
                    <th className="px-3 py-2 text-center text-xs">Pago</th>
                    <th className="px-3 py-2 text-center text-xs">Activo</th>
                    <th className="px-3 py-2 text-center text-xs">Uso</th>
                    <th className="px-3 py-2 text-center text-xs">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/30 text-slate-100">
                  {loading ? (
                    <tr>
                      <td className="px-3 py-6 text-center" colSpan={7}>
                        Cargando…
                      </td>
                    </tr>
                  ) : limits.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center" colSpan={7}>
                        Sin límites configurados
                      </td>
                    </tr>
                  ) : (
                    limits.map((r) => (
                      <LimitRow
                        key={`${r.productId}-${r.periodKind}`}
                        row={r}
                        getName={(id) => productNameById.get(id) ?? String(id)}
                        onEdit={handleEditRow}
                        onToggle={handleToggleActive}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {!!error && (
            <p className="mt-2 text-red-400 text-xs" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LimitRow({
  row,
  getName,
  onEdit,
  onToggle,
  onDelete,
}: {
  row: ClientLimitRow;
  getName: (productId: number) => string;
  onEdit: (row: ClientLimitRow) => void;
  onToggle: (row: ClientLimitRow) => Promise<void>;
  onDelete: (row: ClientLimitRow) => Promise<void>;
}) {
  const [usage, setUsage] = useState<{ loaded: boolean; text: string }>({ loaded: false, text: '—' });

  useEffect(() => {
    (async () => {
      try {
        const u = await getClientLimitUsage(row.clientId, row.productId, row.periodKind as PeriodKind);
        const text = row.maxGallons
          ? `${Number((u as any).usedGallons).toFixed(3)} / ${Number((u as any).maxGallons ?? 0).toFixed(3)} gal`
          : `${Number((u as any).usedGallons).toFixed(3)} gal`;
        setUsage({ loaded: true, text });
      } catch {
        setUsage({ loaded: true, text: 'err' });
      }
    })();
  }, [row.clientId, row.productId, row.periodKind, row.maxGallons]);

  return (
    <tr>
      <td className="px-3 py-2">{row.productName ?? getName(row.productId)}</td>
      <td className="px-3 py-2 text-center">{labelPeriod(row.periodKind as PeriodKind)}</td>
      <td className="px-3 py-2 text-right">{Number(row.maxGallons).toFixed(3)}</td>
      <td className="px-3 py-2 text-center">{row.applyToAllPayments ? 'Todas' : 'Solo crédito'}</td>
      <td className="px-3 py-2 text-center">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
            row.isActive ? 'bg-emerald-600/30 text-emerald-300' : 'bg-slate-700/50 text-slate-300'
          }`}
        >
          {row.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-3 py-2 text-center">{usage.text}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-center gap-1.5">
          <button onClick={() => onEdit(row)} className="p-1.5 rounded hover:bg-slate-800" title="Editar">
            <Pencil size={16} />
          </button>
          <button onClick={() => onToggle(row)} className="p-1.5 rounded hover:bg-slate-800" title="Activar/Desactivar">
            {row.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          </button>
          <button onClick={() => onDelete(row)} className="p-1.5 rounded hover:bg-slate-800" title="Eliminar">
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function labelPeriod(p: PeriodKind) {
  switch (p) {
    case 'day':
      return 'Día';
    case 'week':
      return 'Semana';
    case 'month':
      return 'Mes';
  }
}
