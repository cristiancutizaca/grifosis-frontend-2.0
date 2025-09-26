'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, DollarSign, CreditCard as CardIcon } from 'lucide-react';
import ClientService, { Client } from '../../../src/services/clientService';
import creditService, { Credit } from '../../../src/services/creditService';
import paymentMethodService from '../../../src/services/paymentMethodService';
import { createPaymentsBulk } from '../../../src/services/paymentsService';
import { getUserId } from '../../../src/utils/auth';

type Props = {
  open: boolean;
  onClose: () => void;
  defaultClientId?: number | null;
  onPaid?: () => Promise<void> | void;
};

type UIPaymentMethod = {
  payment_method_id: number;
  name: string;
  is_active?: boolean;
};

// ✅ número robusto (evita NaN con strings, S/ , comas, etc.)
const num = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
};

export default function CreditPayModal({ open, onClose, defaultClientId = null, onPaid }: Props) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // data
  const [clientes, setClientes] = useState<Client[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<UIPaymentMethod[]>([]);

  // form
  const [selectedClientId, setSelectedClientId] = useState<string>(defaultClientId ? String(defaultClientId) : '');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(null);
  const [reference, setReference] = useState<string>('');

  const isClientLocked = !!defaultClientId;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(v ?? 0);

  const clientNameById = useMemo(() => {
    const dict: Record<number, string> = {};
    clientes.forEach((c) => {
      if ((c as any).client_type === 'empresa' && (c as any).company_name) dict[c.client_id] = (c as any).company_name as string;
      else dict[c.client_id] = `${(c as any).first_name ?? c.nombre ?? ''} ${(c as any).last_name ?? c.apellido ?? ''}`.trim();
    });
    return dict;
  }, [clientes]);

  const clientsWithDebtList = useMemo(() => {
    const pending = credits.filter((c) => c.status === 'pending' || c.status === 'overdue');
    const map = new Map<number, { client_id: number; name: string; debt: number }>();
    pending.forEach((c) => {
      const debt = num(c.credit_amount) - num(c.amount_paid);
      const prev = map.get(c.client_id);
      if (prev) prev.debt += debt;
      else {
        map.set(c.client_id, {
          client_id: c.client_id,
          name: clientNameById[c.client_id] || (c.client as any)?.name || `Cliente ${c.client_id}`,
          debt,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.debt - a.debt);
  }, [credits, clientNameById]);

  const clientOptions = useMemo(
    () =>
      isClientLocked && defaultClientId
        ? clientsWithDebtList.filter((c) => c.client_id === defaultClientId)
        : clientsWithDebtList,
    [clientsWithDebtList, isClientLocked, defaultClientId]
  );

  const selectedClientPendingCredits = useMemo(
    () =>
      credits
        .filter((c) => c.client_id === Number(selectedClientId))
        .filter((c) => (c.status === 'pending' || c.status === 'overdue') && num(c.credit_amount) > num(c.amount_paid)),
    [credits, selectedClientId]
  );

  // ====== Multi-selección ======
  const [selectedMap, setSelectedMap] = useState<Record<number, boolean>>({});
  const [rowAmounts, setRowAmounts] = useState<Record<number, string>>({});
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    const nextAmts: Record<number, string> = {};
    selectedClientPendingCredits.forEach((cr) => {
      const saldo = Math.max(0, num(cr.credit_amount) - num(cr.amount_paid));
      nextAmts[cr.credit_id] = saldo.toFixed(2);
    });
    setRowAmounts(nextAmts);
    setSelectedMap({});
    setSelectAll(false);
  }, [selectedClientPendingCredits]);

  const toggleOne = (id: number) => {
    setSelectedMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const all =
        selectedClientPendingCredits.length > 0 &&
        selectedClientPendingCredits.every((cr) => next[cr.credit_id]);
      setSelectAll(all);
      return next;
    });
  };

  const toggleAll = () => {
    const all = !selectAll;
    setSelectAll(all);
    if (all) {
      const m: Record<number, boolean> = {};
      selectedClientPendingCredits.forEach((cr) => (m[cr.credit_id] = true));
      setSelectedMap(m);
    } else {
      setSelectedMap({});
    }
  };

  const selectedItems = useMemo(() => {
    return selectedClientPendingCredits
      .filter((cr) => selectedMap[cr.credit_id])
      .map((cr) => {
        const saldo = Math.max(0, num(cr.credit_amount) - num(cr.amount_paid));
        const raw = parseFloat(rowAmounts[cr.credit_id] ?? '0') || 0;
        const amount = Math.min(raw, saldo); // nunca más del saldo
        return { credit: cr, amount };
      })
      .filter((it) => it.amount > 0);
  }, [selectedClientPendingCredits, selectedMap, rowAmounts]);

  const totalSeleccionado = useMemo(
    () => selectedItems.reduce((s, it) => s + it.amount, 0),
    [selectedItems]
  );

  // ===== Cargas =====
  useEffect(() => {
    if (!open) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [clis, creds, uiMethods] = await Promise.all([
          ClientService.getAllClients(),
          creditService.getAllCredits(),
          paymentMethodService.getUIList(),
        ]);

        setClientes(clis ?? []);
        setCredits(creds ?? []);
        setPaymentMethods(uiMethods ?? []);

        const firstActive = (uiMethods ?? []).find((m) => m.is_active) ?? (uiMethods ?? [])[0];
        setSelectedPaymentMethodId(firstActive ? firstActive.payment_method_id : null);

        if (defaultClientId) setSelectedClientId(String(defaultClientId));
      } catch (e) {
        console.error(e);
        setError('No se pudieron cargar datos para el pago.');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, defaultClientId]);

  // ===== Submit =====
  const canSubmit = useMemo(() => {
    if (!selectedClientId || !selectedPaymentMethodId) return false;
    if (selectedItems.length === 0) return false;
    if (totalSeleccionado <= 0) return false;
    return true;
  }, [selectedClientId, selectedPaymentMethodId, selectedItems, totalSeleccionado]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const userId = getUserId();
    if (!userId) {
      alert('No se pudo obtener el usuario del token. Vuelve a iniciar sesión.');
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      // ✅ PAGO EN LOTE — el backend espera `items`
      const payload = {
        payment_method_id: selectedPaymentMethodId!,
        user_id: Number(userId),
        notes: reference?.trim() || undefined,
        items: selectedItems.map((it) => ({
          credit_id: it.credit.credit_id,
          amount: Number(it.amount.toFixed(2)),
        })),
      };

      const resp: any = await createPaymentsBulk(payload as any);

      // Si backend devuelve créditos actualizados, usamos esos
      const updatedCredits: Credit[] | undefined =
        resp?.updated || resp?.updatedCredits || undefined;

      if (Array.isArray(updatedCredits) && updatedCredits.length) {
        const map = new Map<number, Credit>();
        updatedCredits.forEach((c) => map.set(c.credit_id, c));
        setCredits((prev) => prev.map((c) => (map.has(c.credit_id) ? map.get(c.credit_id)! : c)));
      } else {
        // Optimista
        const paidById = new Map<number, number>();
        selectedItems.forEach((it) =>
          paidById.set(it.credit.credit_id, (paidById.get(it.credit.credit_id) ?? 0) + it.amount)
        );

        setCredits((prev) =>
          prev.map((c) => {
            const add = paidById.get(c.credit_id);
            if (!add) return c;
            const newPaid = num(c.amount_paid) + add;
            const total = num(c.credit_amount);
            const stillOwes = newPaid < total;
            const isOverdue = !!c.due_date && new Date(c.due_date) < new Date();

            return {
              ...c,
              amount_paid: Number(newPaid.toFixed(2)) as any,
              status: stillOwes ? (isOverdue ? ('overdue' as any) : ('pending' as any)) : ('paid' as any),
            };
          })
        );
      }

      await onPaid?.();
      alert('Pagos registrados exitosamente');
      onClose();
    } catch (e: any) {
      console.error(e);
      // Muestra mensaje exacto del backend si viene (por ejemplo: "supera el saldo...")
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Error al registrar los pagos. Revisa y vuelve a intentar.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-white font-semibold">Pagar créditos</h2>
          <button onClick={onClose} className="p-2 hover:opacity-80" aria-label="Cerrar">
            <X className="h-5 w-5 text-slate-300" />
          </button>
        </div>

        <div className="px-4 py-4">
          {loading ? (
            <p className="text-slate-300 text-sm">Cargando...</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* Cliente */}
              <label className="block text-sm">
                <span className="block mb-1 text-slate-300">Cliente</span>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={isClientLocked}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {!isClientLocked && <option value="">Seleccionar cliente</option>}
                  {clientOptions.map((c) => (
                    <option key={c.client_id} value={c.client_id}>
                      {(clientNameById[c.client_id] || c.name) + ' - ' + formatCurrency(c.debt)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Créditos del cliente */}
              {selectedClientId && selectedClientPendingCredits.length > 0 ? (
                <div className="text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Créditos</span>
                    <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                      <input type="checkbox" checked={selectAll} onChange={toggleAll} className="accent-green-500" />
                      Seleccionar todo
                    </label>
                  </div>

                  <div className="max-h-56 overflow-auto rounded-lg border border-slate-700">
                    {selectedClientPendingCredits.map((cr) => {
                      const saldo = Math.max(0, num(cr.credit_amount) - num(cr.amount_paid));
                      const overdue = !!cr.due_date && new Date(cr.due_date) < new Date() && saldo > 0;

                      return (
                        <label key={cr.credit_id} className="flex items-center gap-3 px-3 py-2 border-b border-slate-800 last:border-0">
                          <input
                            type="checkbox"
                            className="accent-green-500"
                            checked={!!selectedMap[cr.credit_id]}
                            onChange={() => toggleOne(cr.credit_id)}
                          />
                          <div className="flex-1 text-slate-200">
                            <div className="font-medium">
                              #{cr.credit_id}{' '}
                              {overdue && <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-red-500 text-red-400">Vencido</span>}
                            </div>
                            <div className="text-xs text-slate-400">
                              saldo {formatCurrency(saldo)}
                              {cr.due_date ? ` • vence ${new Date(cr.due_date).toLocaleDateString('es-PE')}` : ''}
                            </div>
                          </div>

                          <div className="flex items-center rounded-md border border-slate-600 bg-slate-800 px-2">
                            <DollarSign className="h-3 w-3 text-slate-400 mr-1" />
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              max={saldo}
                              value={rowAmounts[cr.credit_id] ?? saldo.toFixed(2)}
                              onChange={(e) => setRowAmounts((prev) => ({ ...prev, [cr.credit_id]: e.target.value }))}
                              className="w-28 bg-transparent py-1 text-right text-white outline-none placeholder-slate-400"
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : selectedClientId ? (
                <div className="text-xs text-slate-400">Este cliente no tiene créditos pendientes/vencidos.</div>
              ) : null}

              {/* Resumen total + método */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-700 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Total seleccionado</div>
                  <div className="text-base font-semibold text-white">{formatCurrency(totalSeleccionado)}</div>
                </div>

                <label className="text-sm block">
                  <span className="block mb-1 text-slate-300">Método de pago</span>
                  <div className="flex items-center rounded-lg border border-slate-600 bg-slate-800">
                    <select
                      className="w-full bg-transparent py-2 px-3 text-white outline-none"
                      value={selectedPaymentMethodId ?? ''}
                      onChange={(e) => setSelectedPaymentMethodId(Number(e.target.value))}
                    >
                      {paymentMethods.map((m) => (
                        <option key={m.payment_method_id} value={m.payment_method_id}>
                          {m.name ?? `Método ${m.payment_method_id}`}
                        </option>
                      ))}
                    </select>
                    <div className="px-3 text-slate-400">
                      <CardIcon className="h-4 w-4" />
                    </div>
                  </div>
                </label>
              </div>

              {/* Referencia */}
              <label className="text-sm block">
                <span className="block mb-1 text-slate-300">Referencia (opcional)</span>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej. voucher, nota, etc."
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-green-500"
                />
              </label>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || processing}
                  className="rounded-lg bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  {processing ? 'Procesando...' : 'Pagar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
