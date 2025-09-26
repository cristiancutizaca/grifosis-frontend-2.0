'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Shield, AlertTriangle, Search, Users, CreditCard,
  ChevronDown, ChevronRight
} from 'lucide-react';

import creditService, { Credit, CreditsDashboard } from '../../src/services/creditService';
import ClientService, { Client } from "../../src/services/clientService";
import CreditPayModal from './modal/CreditPayModal';

type GroupedClient = {
  client_id: number;
  name: string;
  credits: Credit[];
  totals: { credit_amount: number; amount_paid: number; balance: number };
  statusSummary: { pending: number; overdue: number; paid: number };
};

type CreditClientLoose = {
  client_id?: number;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  document_number?: string | number | null;
};

// -------- helpers --------
const num = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const todayStart = startOfDay(new Date());
const toDateOnly = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : startOfDay(d);
};
const remaining = (cr: Credit) => Math.max(0, num(cr.credit_amount) - num(cr.amount_paid));
const isPaid = (cr: Credit) => remaining(cr) <= 0.0001 || cr.status === 'paid';
const isOverdue = (cr: Credit) => {
  const due = toDateOnly((cr as any)?.due_date as any);
  return !isPaid(cr) && !!due && due < todayStart;
};
const effectiveStatus = (cr: Credit) => (isPaid(cr) ? 'paid' : isOverdue(cr) ? 'overdue' : 'pending');
// -------------------------

type CardFilter = 'all' | 'withDebt' | 'overdue';

// 📏 Anchos (100% exacto, sin espacio muerto)
const COLS = {
  cliente:   'w-[20%]',
  creditos:  'w-[6%]',   // oculto en <md
  monto:     'w-[18%]',  // Deuda total / Monto crédito
  pagado:    'w-[16%]',  // Crédito pagado / Pagado (detalle)
  saldo:     'w-[18%]',  // Falta por pagar / Saldo
  estado:    'w-[10%]',
  acciones:  'w-[12%]',  // Acciones / Vencimiento (detalle)
};

const GrifoCreditManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [credits, setCredits] = useState<Credit[]>([]);
  const [dashboard, setDashboard] = useState<CreditsDashboard>({ total: 0, overdue: 0, paid: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientes, setClientes] = useState<Client[]>([]);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payModalClientId, setPayModalClientId] = useState<number | null>(null);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [totalDebt, setTotalDebt] = useState(0);
  const [clientsWithDebt, setClientsWithDebt] = useState(0);

  const [cardFilter, setCardFilter] = useState<CardFilter>('all');
  const tableRef = useRef<HTMLDivElement>(null);

  // ======== Carga inicial ========
  useEffect(() => {
    (async () => {
      try {
        const data = await ClientService.getAllClients();
        setClientes(data);
      } catch {
        setClientes([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadDashboard(), loadCredits()]);
      } catch {
        setError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadDashboard = async () => {
    try { setDashboard(await creditService.getCreditsDashboard()); }
    catch (err) { console.error('Error loading dashboard:', err); }
  };

  const loadCredits = async () => {
    try {
      const data = await creditService.getAllCredits();
      setCredits(data);
      const debt = data.reduce((sum, c) => sum + remaining(c), 0);
      const uniqueClients = new Set(data.filter(c => remaining(c) > 0.0001).map(c => c.client_id)).size;
      setTotalDebt(debt);
      setClientsWithDebt(uniqueClients);
    } catch (err) {
      console.error('Error loading credits:', err);
      setError('Error al cargar los créditos');
    }
  };

  // ======== nombres / normalización ========
  const clientNameById = useMemo(() => {
    const dict: Record<number, string> = {};
    clientes.forEach(c => {
      dict[c.client_id] = c.client_type === 'empresa' && c.company_name
        ? c.company_name
        : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
    });
    return dict;
  }, [clientes]);

  const norm = (s?: string) =>
    (s ?? '').toString().normalize('NFD')
      // @ts-ignore
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase().trim();

  const getClientDisplayName = (credit: Credit) => {
    const mapped = clientNameById[credit.client_id];
    if (mapped?.trim()) return mapped;
    const cc = credit.client as CreditClientLoose | undefined;
    const joined = [cc?.first_name, cc?.last_name].filter(Boolean).join(' ').trim();
    const byLoose = cc?.name?.trim() || cc?.company_name?.trim() || (joined || undefined);
    const legacy = (credit as any).client_name as string | undefined;
    return (byLoose || legacy || `Cliente ${credit.client_id}`).trim();
  };

  // ======== Filtro por tarjeta + búsqueda ========
  const visibleCredits = useMemo(() => {
    let list = credits;

    if (cardFilter === 'withDebt') list = list.filter(c => remaining(c) > 0.0001);
    else if (cardFilter === 'overdue') list = list.filter(c => isOverdue(c));

    const term = norm(searchTerm);
    if (!term) return list;

    return list.filter((credit) => {
      const displayName = getClientDisplayName(credit);
      const nameOk = norm(displayName).includes(term);

      const creditIdOk = credit.credit_id?.toString().includes(searchTerm.trim());
      const saleIdOk = credit.sale_id ? credit.sale_id.toString().includes(searchTerm.trim()) : false;
      const clientIdOk = credit.client_id?.toString().includes(searchTerm.trim());
      const doc = (credit.client as CreditClientLoose | undefined)?.document_number ?? (credit as any)?.document_number;
      const docOk = doc ? String(doc).includes(searchTerm.trim()) : false;

      return nameOk || creditIdOk || saleIdOk || clientIdOk || docOk;
    });
  }, [credits, cardFilter, searchTerm, clientNameById]);

  // ======== Agrupación por cliente ========
  const grouped = useMemo<GroupedClient[]>(() => {
    const map = new Map<number, GroupedClient>();

    for (const cr of visibleCredits) {
      const name = getClientDisplayName(cr);
      const ca = num(cr.credit_amount);
      const ap = num(cr.amount_paid);
      const bal = remaining(cr);
      const eff = effectiveStatus(cr);

      const g = map.get(cr.client_id);
      if (!g) {
        map.set(cr.client_id, {
          client_id: cr.client_id, name, credits: [cr],
          totals: { credit_amount: ca, amount_paid: ap, balance: bal },
          statusSummary: {
            pending: eff === 'pending' ? 1 : 0,
            overdue: eff === 'overdue' ? 1 : 0,
            paid: eff === 'paid' ? 1 : 0,
          },
        });
      } else {
        g.credits.push(cr);
        g.totals.credit_amount += ca;
        g.totals.amount_paid += ap;
        g.totals.balance += bal;
        if (eff === 'pending') g.statusSummary.pending++;
        if (eff === 'overdue') g.statusSummary.overdue++;
        if (eff === 'paid') g.statusSummary.paid++;
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [visibleCredits]);

  // ======== UI utils ========
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-PE');
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500/20 text-green-400 border-green-400';
      case 'overdue': return 'bg-red-500/20 text-red-400 border-red-400';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-400';
    }
  };
  const getGroupBadge = (g: GroupedClient) => {
    if (g.statusSummary.overdue > 0) return { text: `Vencidos: ${g.statusSummary.overdue}`, cls: 'bg-red-500/20 text-red-400 border-red-400' };
    if (g.statusSummary.pending > 0) return { text: `Pendientes: ${g.statusSummary.pending}`, cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-400' };
    return { text: 'Pagado', cls: 'bg-green-500/20 text-green-400 border-green-400' };
  };

  // ======== Modal & acciones ========
  const openPayModal = (clientId: number) => { setPayModalClientId(clientId); setPayModalOpen(true); };
  const onPaidRefresh = async () => { await Promise.all([loadCredits(), loadDashboard()]); };
  const toggleExpand = (clientId: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(clientId) ? next.delete(clientId) : next.add(clientId);
      return next;
    });
  };

  // ======== Tarjetas clickeables ========
  const handleCardClick = (target: CardFilter) => {
    setCardFilter(prev => (prev === target ? 'all' : target));
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  const cardBase = "rounded-2xl p-5 flex items-center gap-4 border bg-slate-800 shadow transition";
  const cardClickable = (active: boolean) =>
    `${cardBase} cursor-pointer hover:bg-slate-700/40 hover:translate-y-[1px] ` +
    (active ? " border-green-500 ring-2 ring-green-500/30 " : " border-slate-700 ");
  const cardStatic = `${cardBase} border-slate-700 select-none`;
  const overdueCount = useMemo(() => credits.filter(isOverdue).length, [credits]);

  // ======== Render ========
  if (loading) {
    return <div className="p-6 flex items-center justify-center"><div className="text-white">Cargando datos de créditos...</div></div>;
  }
  if (error) {
    return <div className="p-6 flex items-center justify-center"><div className="text-red-400">Error: {error}</div></div>;
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-2">
            <CreditCard className="text-green-500" size={28} />
            Créditos
          </h1>
          <p className="text-sm text-slate-400 mt-1">Gestión y monitoreo de créditos a clientes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:gap-4">
          <span className="text-slate-300">Sucursal Lima</span>
          <span className="text-slate-300">Última actualización: {new Date().toLocaleDateString('es-PE')}</span>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className={cardStatic}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-tr from-red-500 to-red-600">
            <CreditCard className="text-white" size={28} />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium">Total Deuda Pendiente</div>
            <div className="text-xl font-bold text-white">{formatCurrency(totalDebt)}</div>
          </div>
        </div>

        <div
          role="button"
          aria-pressed={cardFilter === 'withDebt'}
          onClick={() => handleCardClick('withDebt')}
          className={cardClickable(cardFilter === 'withDebt')}
          title="Ver solo clientes con deuda (pendiente o vencida)"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-tr from-blue-700 to-blue-800">
            <Users className="text-white" size={28} />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium">Clientes con Deuda</div>
            <div className="text-xl font-bold text-white">{clientsWithDebt}</div>
            {cardFilter === 'withDebt' && <div className="text-xs mt-1 text-green-400">Filtro activo</div>}
          </div>
        </div>

        <div
          role="button"
          aria-pressed={cardFilter === 'overdue'}
          onClick={() => handleCardClick('overdue')}
          className={cardClickable(cardFilter === 'overdue')}
          title="Ver solo créditos vencidos"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-tr from-orange-500 to-orange-600">
            <AlertTriangle className="text-white" size={28} />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium">Créditos Vencidos</div>
            <div className="text-xl font-bold text-white">{overdueCount}</div>
            {cardFilter === 'overdue' && <div className="text-xs mt-1 text-green-400">Filtro activo</div>}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar cliente, ID de crédito, ID de venta o DNI/RUC"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-green-500"
            />
          </div>
          <div className="flex gap-2">
            {cardFilter !== 'all' && (
              <button
                onClick={() => setCardFilter('all')}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
                title="Quitar filtro de tarjeta"
              >
                Limpiar filtro
              </button>
            )}
            <button
              onClick={() => { loadCredits(); loadDashboard(); }}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla agrupada por cliente */}
      <div ref={tableRef} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            {/* colgroup compacto */}
            <colgroup>
              <col className={`${COLS.cliente}`} />
              <col className={`hidden md:table-column ${COLS.creditos}`} />
              <col className={`${COLS.monto}`} />
              <col className={`${COLS.pagado}`} />
              <col className={`${COLS.saldo}`} />
              <col className={`${COLS.estado}`} />
              <col className={`${COLS.acciones}`} />
            </colgroup>
            <thead className="bg-slate-700 sticky top-0 z-10">
              <tr>
                <th className="text-left py-3 pl-2 pr-2 text-slate-300 font-medium">Cliente</th>
                <th className="hidden md:table-cell text-left py-3 px-2 text-slate-300 font-medium">Créditos</th>
                <th className="text-right py-3 px-2 text-slate-300 font-medium">Deuda Total</th>
                <th className="text-right py-3 px-2 text-slate-300 font-medium">Crédito Pagado</th>
                <th className="text-right py-3 px-2 text-slate-300 font-medium">Falta por Pagar</th>
                <th className="text-left py-3 px-2 text-slate-300 font-medium">Estado</th>
                <th className="text-left py-3 px-2 text-slate-300 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => {
                const isExpanded = expanded.has(g.client_id);
                const isPayable = g.credits.some(cr => remaining(cr) > 0.0001);

                const ss = g.statusSummary;
                const badge =
                  ss.overdue > 0
                    ? { text: `Vencidos: ${ss.overdue}`, cls: 'bg-red-500/20 text-red-400 border-red-400' }
                    : ss.pending > 0
                      ? { text: `Pendientes: ${ss.pending}`, cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-400' }
                      : { text: 'Pagado', cls: 'bg-green-500/20 text-green-400 border-green-400' };

                return (
                  <React.Fragment key={g.client_id}>
                    {/* Fila resumen */}
                    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                      <td className="py-3 pl-2 pr-2 text-white">
                        <button
                          onClick={() => toggleExpand(g.client_id)}
                          className="inline-flex items-center gap-2 hover:opacity-90 max-w-full"
                          title={isExpanded ? "Contraer" : "Expandir"}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                          <span className="truncate">{g.name}</span>
                        </button>
                      </td>
                      <td className="hidden md:table-cell py-3 px-2 text-slate-300">{g.credits.length}</td>
                      <td className="py-3 px-2 text-slate-300 text-right">{formatCurrency(g.totals.credit_amount)}</td>
                      <td className="py-3 px-2 text-slate-300 text-right">{formatCurrency(g.totals.amount_paid)}</td>
                      <td className="py-3 px-2 text-slate-300 text-right">{formatCurrency(g.totals.balance)}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded-full border text-xs font-semibold ${badge.cls}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => openPayModal(g.client_id)}
                          disabled={!isPayable}
                          className={`text-sm px-3 py-1.5 rounded-lg ${
                            isPayable
                              ? 'bg-green-500 hover:bg-green-600 text-white'
                              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          }`}
                          title={isPayable ? 'Pagar créditos de este cliente' : 'Sin saldo pendiente'}
                        >
                          Pagar
                        </button>
                      </td>
                    </tr>

                    {/* Detalle (espejo del colgroup) */}
                    {isExpanded && (
                      <tr className="border-b border-slate-700/50">
                        <td colSpan={7} className="p-0">
                          <div className="bg-slate-900/40">
                            <div className="overflow-x-auto">
                              <table className="w-full table-fixed">
                                <colgroup>
                                  <col className={`${COLS.cliente}`} />
                                  <col className={`hidden md:table-column ${COLS.creditos}`} />
                                  <col className={`${COLS.monto}`} />
                                  <col className={`${COLS.pagado}`} />
                                  <col className={`${COLS.saldo}`} />
                                  <col className={`${COLS.estado}`} />
                                  <col className={`${COLS.acciones}`} />
                                </colgroup>
                                <thead>
                                  <tr className="text-xs uppercase text-slate-400">
                                    <th className="text-left py-2 pl-2 pr-2"></th>
                                    <th className="hidden md:table-cell text-left py-2 px-2">Crédito</th>
                                    <th className="text-right py-2 px-2">Monto Crédito</th>
                                    <th className="text-right py-2 px-2">Pagado</th>
                                    <th className="text-right py-2 px-2">Saldo</th>
                                    <th className="text-left py-2 px-2">Estado</th>
                                    <th className="text-left py-2 px-2">Vencimiento</th> {/* debajo de Acciones */}
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.credits.map((cr) => {
                                    const bal = remaining(cr);
                                    const eff = effectiveStatus(cr);
                                    return (
                                      <tr key={cr.credit_id} className="border-t border-slate-800">
                                        <td className="py-2 pl-2 pr-2"></td>
                                        <td className="hidden md:table-cell py-2 px-2 text-slate-200">#{cr.credit_id}</td>
                                        <td className="py-2 px-2 text-slate-300 text-right">{formatCurrency(num(cr.credit_amount))}</td>
                                        <td className="py-2 px-2 text-slate-300 text-right">{formatCurrency(num(cr.amount_paid))}</td>
                                        <td className="py-2 px-2 text-slate-300 text-right">{formatCurrency(bal)}</td>
                                        <td className="py-2 px-2">
                                          <span className={`px-2 py-1 rounded-full border text-xs font-semibold ${getStatusColor(eff)}`}>
                                            {eff === 'paid' ? 'Pagado' : eff === 'overdue' ? 'Vencido' : 'Pendiente'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 text-slate-300 whitespace-nowrap">
                                          {(cr as any).due_date ? formatDate((cr as any).due_date) : '-'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Info de paginación */}
        <div className="flex items-center justify-between mt-4 p-4">
          <div className="text-slate-400 text-sm">
            Mostrando {grouped.length} clientes (de {new Set(visibleCredits.map(c => c.client_id)).size}) • {visibleCredits.length} créditos filtrados
            {cardFilter !== 'all' && (
              <span className="ml-2 text-xs text-green-400">
                — Filtro: {cardFilter === 'withDebt' ? 'Con deuda' : 'Vencidos'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tarjeta de Información */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Shield className="text-blue-400" size={20} />
          Información
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Total Créditos:</span>
            <span className="text-white font-medium">{dashboard.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Pagados:</span>
            <span className="text-green-400 font-medium">{dashboard.paid}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Vencidos (calculado):</span>
            <span className="text-red-400 font-medium">{overdueCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Deuda Total Pendiente:</span>
            <span className="text-white font-medium">{formatCurrency(totalDebt)}</span>
          </div>
        </div>
      </div>

      {/* Modal de pago */}
      <CreditPayModal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        defaultClientId={payModalClientId ?? undefined}
        onPaid={async () => { await onPaidRefresh(); }}
      />
    </div>
  );
};

export default GrifoCreditManagement;
