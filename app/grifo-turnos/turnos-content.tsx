'use client';
import MeterReadingContent from "./meter-reading-content";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DollarSign,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  CheckCircle2,
  LogIn,
  LogOut,
  User,
} from 'lucide-react';

import saleService from '../../src/services/saleService';
import clientService, { Client as BaseClient } from '../../src/services/clientService';
import pumpService from '../../src/services/pumpService';
import nozzleService from '../../src/services/nozzleService';
import cashBoxService from '../../src/services/cashBoxService';
import paymentMethodService from '../../src/services/paymentMethodService';

import { fmtTime, fmtDateTime } from '../../src/utils/dates';
import { asArray } from '../../src/utils/arrays';
import { cleanNotes } from '../../src/utils/text';
import { getPumpNumericOrder } from '../../src/utils/pumps';
import { parseGrossFromNotes } from '../../src/utils/sales';
import { IGV_BY_FUEL, type FuelType } from '../../src/constants/fuels';
import { getPaymentLabel } from '../../src/constants/payments';
import { mapClient } from '../../src/utils/clients';

import { useTurnos } from './hooks/use-turnos';
import { useShiftHours } from './hooks/use-shift-hours';
import { useActiveShift } from './hooks/use-active-shift';
import { useEmpleadoActual } from './hooks/use-empleado-actual';
import type { ShiftName, ShiftHours } from './turnos/shifts';

import {
  shiftForApi,
  nextShift,
  toYMD,
  toLocalYMD,
  normShiftForUi,
} from './turnos/shifts';

import {
  openStateKey,
  CURRENT_OPEN_FLAG,
  readSuggest,
  writeSuggest,
} from './turnos/storage';

import { mapSessionsToEvents } from './turnos/history';
import {
  calcTotalVentasTurno,
  calcTotalVentasTurnoBruto,
  buildTotalsByMethod,
} from './utils/sales';

import CajaHistorialModal, { CajaEvent, CajaHistoryDay } from './components/CajaHistorialModal';
import DetalleVentasModal from './components/DetalleVentasModal';
import paymentsService, { CreditPaymentItem } from '../../src/services/paymentsService';

// --- Helpers para inferir turno por hora del evento ---
const getRangeForDate = (base: Date, hhmmStart: string, hhmmEnd: string) => {
  const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const s = toMin(hhmmStart), e = toMin(hhmmEnd);
  const fromD = new Date(base), toD = new Date(base);
  fromD.setHours(Math.floor(s/60), s%60, 0, 0);
  toD.setHours(Math.floor(e/60), e%60, 0, 0);
  // Manejo de turnos que cruzan medianoche
  if (s > e) {
    const t = base.getHours() * 60 + base.getMinutes();
    if (t < e) fromD.setDate(fromD.getDate() - 1);
    else toD.setDate(toD.getDate() + 1);
  }
  return { fromD, toD };
};

const shiftFromTimestamp = (ts: string | number | Date, hours: ShiftHours): ShiftName | null => {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return null;
  const names = Object.keys(hours || {}) as ShiftName[];
  for (const name of names) {
    const w = hours[name];
    if (!w) continue;
    const { fromD, toD } = getRangeForDate(d, w.start, w.end);
    if (d >= fromD && d < toD) return name;
  }
  return null;
};


/* Tipos locales */
const HISTORY_KEY = 'caja_history_v1';
const loadHistory = (): CajaHistoryDay[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
};
const saveHistory = (arr: CajaHistoryDay[]) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch {}
};

interface PumpInfo { pump_id: number; pump_name: string; nozzles: any[]; }
interface Client extends BaseClient { id: number; }
type PumpData = { pump_id?: number; id?: number; pump_name?: string; pump_number?: string; nombre?: string; nozzles?: any[]; };
interface Product { id: number; nombre: FuelType; precio: number; tipo: string; }

type MethodDetailRow = { product: string; gallons: number; gross: number };
type MethodDetail = { label: string; rows: MethodDetailRow[]; totalGallons: number; totalGross: number };

/* >>> Helper para limpiar nombres de turno (evita “Buho” cortado) <<< */
const cleanShiftLabel = (s: string) =>
  String(s ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // quita zero-width/invisibles
    .replace(/\s+/g, ' ')                  // colapsa espacios/saltos
    .trim();
/* Helpers de flags locales */
const readCurrentOpenFlag = (dayKey: string): { day: string; shift: ShiftName; ts?: string } | null => {
  try {
    const raw = localStorage.getItem(CURRENT_OPEN_FLAG);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const shift: string = String(obj?.shift || '');
    if (obj?.day === dayKey && shift) {
      return { day: obj.day, shift: shift as ShiftName, ts: obj.ts };
    }
  } catch {}
  return null;
};

// Acepta la lista de turnos disponibles
const clearLocalOpenFlagsForDay = (dayKey: string, shifts: ShiftName[]) => {
  try {
    shifts.forEach(s => localStorage.removeItem(openStateKey(dayKey, s)));
    const cur = readCurrentOpenFlag(dayKey);
    if (cur) localStorage.removeItem(CURRENT_OPEN_FLAG);
  } catch {}
};


const TurnosContent: React.FC = () => {
  const { cashControl, updateCashControl } = useTurnos();
  const updateRef = useRef(updateCashControl);
  useEffect(() => { updateRef.current = updateCashControl; }, [updateCashControl]);

  /* HORARIOS / TURNO ACTIVO */
  const { hours } = useShiftHours() as { hours: ShiftHours };
  const shiftNames = useMemo<ShiftName[]>(() => Object.keys(hours || {}) as ShiftName[], [hours]);
  const firstShiftName = shiftNames[0]; // puede ser undefined en primer render
  const { now, setNow, turnoActivo, from, to, storageDay } = useActiveShift(hours);

  const getRange = (name: ShiftName) => {
    const w = hours?.[name];
    if (!w) {
      // fallback: todo el día si aún no cargan horarios
      const fromD = new Date(now); fromD.setHours(0,0,0,0);
      const toD = new Date(now);   toD.setHours(23,59,59,999);
      return { from: fromD, to: toD };
    }
    const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    const s = toMinutes(w.start), e = toMinutes(w.end), t = now.getHours() * 60 + now.getMinutes();
    const fromD = new Date(now), toD = new Date(now);
    fromD.setHours(Math.floor(s/60), s%60, 0, 0);
    toD.setHours(Math.floor(e/60), e%60, 0, 0);
    if (s > e && t < e) fromD.setDate(fromD.getDate() - 1);
    if (s > e && t >= s) toD.setDate(toD.getDate() + 1);
    return { from: fromD, to: toD };
  };

  /* USUARIO */
  const { empleadoActual } = useEmpleadoActual();
  useEffect(() => {
    const nombre = empleadoActual?.full_name || empleadoActual?.username || 'Operador';
    if (nombre && cashControl.responsable !== nombre) updateRef.current({ responsable: nombre });
  }, [empleadoActual, cashControl.responsable]);

  /* DATA BÁSICA */
  const [products] = useState<Product[]>([
    { id: 1, nombre: 'Diesel',  precio: 3.0,  tipo: 'diesel'  },
    { id: 2, nombre: 'Premium', precio: 4.01, tipo: 'gasolina'},
    { id: 3, nombre: 'Regular', precio: 4.0,  tipo: 'gasolina'},
  ]);

  const [clients, setClients] = useState<Client[]>([]);
  const clientById = useMemo(() => {
    const m = new Map<number, Client>();
    clients.forEach((c) => m.set(Number(c.id), c));
    return m;
  }, [clients]);

  const [pumpList, setPumpList] = useState<PumpInfo[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const [clientsData, pumpsDataRaw] = await Promise.all([
          clientService.getAllClients(),
          pumpService.getAllPumps(),
        ]);
        setClients(clientsData.map(mapClient));
        const pumpsArr = Array.isArray(pumpsDataRaw) ? (pumpsDataRaw as any[]) : [];
        pumpsArr.sort((a, b) => getPumpNumericOrder(a) - getPumpNumericOrder(b));
        const pumpObjects: PumpInfo[] = pumpsArr.map((p: PumpData, idx) => {
          const id = Number(p?.pump_id ?? p?.id ?? idx + 1);
          const num = getPumpNumericOrder(p);
          const name = String(p?.pump_name ?? p?.nombre ?? p?.pump_number ?? `Surtidor ${String(num).padStart(3,'0')}`);
          return { pump_id: id, pump_name: name, nozzles: [] };
        });
        setPumpList(pumpObjects);
      } catch (err) {
        console.error('Error inicial (clientes/surtidores):', err);
      }
    })();
  }, []);

  /* VENTAS */
  const RECENT_LIMIT = 25;
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loadingRecentSales, setLoadingRecentSales] = useState(false);
  const [pmCatalog, setPmCatalog] = useState<any[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const refreshRecentSales = async () => {
    setLoadingRecentSales(true);
    try {
      const [salesRaw, allNozzlesRaw, pmCatalogRaw] = await Promise.all([
        saleService.getRecentSales(RECENT_LIMIT),
        nozzleService.getAllNozzles(),
        paymentMethodService.getActive().catch(() => []),  // ✅ SOLO ACTIVOS
      ]);

      const sales: any[] = asArray<any>(salesRaw);
      const allNozzles: any[] = asArray<any>(allNozzlesRaw);
      const catAll: any[] = asArray<any>(pmCatalogRaw) || [];
      const cat = catAll.filter((m: any) => (m?.is_active ?? m?.enabled ?? m?.active ?? true) === true);
      setPmCatalog(cat);

      const pmMap = new Map<number, string>();
      for (const m of cat) {
        const id = Number(m?.payment_method_id ?? m?.id);
        const name = String(m?.method_name ?? m?.name ?? '').trim();
        if (id && name) pmMap.set(id, name);
      }

      const nozzleMap = new Map<number, {
        pump_id?: number;
        product_name?: string;
        unit_price?: number;
        nozzle_number?: number;
      }>();

      for (const n of allNozzles) {
        const nid = Number(n?.nozzle_id ?? n?.id);
        if (!Number.isFinite(nid)) continue;

        const pump_id = Number(n?.pump_id ?? n?.pump?.pump_id);

        const product_name = String(
          n?.product?.name ?? n?.producto?.nombre ?? ''
        ) || undefined;

        const unit_price_raw = Number(n?.product?.unit_price ?? n?.producto?.precio ?? NaN);
        const unit_price =
          Number.isFinite(unit_price_raw) && unit_price_raw > 0 ? unit_price_raw : undefined;

        const nozzle_number_raw = Number(
          n?.nozzle_number ?? n?.number ?? n?.nozzle?.number ?? NaN
        );
        const nozzle_number =
          Number.isFinite(nozzle_number_raw) ? nozzle_number_raw : undefined;

        nozzleMap.set(nid, { pump_id, product_name, unit_price, nozzle_number });
      }

      const priceByFuel: Record<string, number> = {
        Diesel:  products.find((p) => p.nombre === 'Diesel')?.precio  ?? 0,
        Premium: products.find((p) => p.nombre === 'Premium')?.precio ?? 0,
        Regular: products.find((p) => p.nombre === 'Regular')?.precio ?? 0,
      };
      const pumpNameById = new Map(pumpList.map((p) => [p.pump_id, p.pump_name]));

      const enriched = sales.map((s: any) => {
        const nz = nozzleMap.get(Number(s.nozzle_id));
        const productName = nz?.product_name ?? '—';
        const pumpName = pumpNameById.get(nz?.pump_id ?? -1) ?? (nz?.pump_id ? `Surtidor ${nz.pump_id}` : 'Surtidor —');
        const unitPrice = nz?.unit_price ?? (productName ? priceByFuel[productName] ?? 0 : 0);

        const net = Number(s.final_amount ?? s.total_amount ?? 0);
        const rate = IGV_BY_FUEL[productName as keyof typeof IGV_BY_FUEL] ?? 0.18;
        let gross = parseGrossFromNotes(s?.notes ?? '');
        if (gross == null) gross = net > 0 ? net * (1 + rate) : 0;

        const volume = Number(s.volume_gallons ?? s.quantity_gallons ?? NaN);
        const gallons = Number.isFinite(volume) && volume > 0 ? volume : (unitPrice > 0 ? net / unitPrice : null);

        let uiClientName: string | undefined =
          s?.client?.name || [s?.client?.first_name, s?.client?.last_name].filter(Boolean).join(' ') || s?.client_name;
        if (!uiClientName && s?.client_id) {
          const c = clientById.get(Number(s.client_id));
          if (c) uiClientName = [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email || `Cliente ${c.id}`;
        }

        const discountAmount = Number(s.discount_amount ?? 0) || 0;

        const labelFromPayload = (typeof s?.payment_method === 'string' && s.payment_method.trim())
          ? s.payment_method.trim() : '';
        const labelFromCatalog = pmMap.get(Number(s?.payment_method_id || 0)) || '';
        const labelFallback = getPaymentLabel(s) || '';
        const paymentLabel = labelFromPayload || labelFromCatalog || labelFallback || '—';

        return {
          ...s,
          _ui: {
            clientName: uiClientName ?? 'Sin cliente',
            productName,
            pumpName,
            gallons,
            amountGross: gross,
            amountNet: net,
            time: fmtTime(s.sale_timestamp),
            dateTime: fmtDateTime(s.sale_timestamp),
            discountAmount,
            discountText: discountAmount > 0 ? `Desc: S/ ${discountAmount.toFixed(2)}` : 'Sin descuento',
            paymentLabel,
            nozzleNumber: nz?.nozzle_number,
          },
        };
      });

      setRecentSales(enriched);
    } catch (err: any) {
      if (String(err?.message || '').toLowerCase().includes('unauthorized') || err?.response?.status === 401) {
        console.warn('Sesión expirada. Inicia sesión nuevamente.');
      } else {
        console.error(err);
      }
      setRecentSales([]);
    } finally {
      setLoadingRecentSales(false);
    }
  };

  useEffect(() => {
    refreshRecentSales();
    const interval = setInterval(refreshRecentSales, 15000);
    return () => clearInterval(interval);
  }, [clientById, pumpList]);

  /* FILTROS (Resumen derecha) */
  const [resumenShift, setResumenShift] = useState<ShiftName>(turnoActivo);
  useEffect(() => setResumenShift(turnoActivo), [turnoActivo]);

  const filteredRecentSales = useMemo(() => {
    const { from: f, to: t } = getRange(resumenShift);
    return recentSales.filter((s: any) => {
      const ts = new Date(s?.sale_timestamp ?? s?.timestamp ?? 0);
      return Number.isFinite(ts.getTime()) && ts >= f && ts < t;
    });
  }, [recentSales, resumenShift, now]);

  /* >>> NUEVO: créditos por cliente para el reporte <<< */
  const creditClientsForReport = useMemo(() => {
    const agg = new Map<string, { client: string; fuel: string; gallons: number; gross: number }>();
    for (const s of filteredRecentSales) {
      const label = String(s?._ui?.paymentLabel ?? '').toLowerCase();
      const isCredit = label.includes('credito') || label.includes('crédito') || label.includes('credit');
      if (!isCredit) continue;

      const client =
        s._ui?.clientName ||
        s.client?.name ||
        [s.client?.first_name, s.client?.last_name].filter(Boolean).join(' ') ||
        s.client_name ||
        'Sin cliente';

      const fuel    = String(s._ui?.productName ?? '—');
      const gallons = Number(s._ui?.gallons ?? 0) || 0;
      const gross   = Number(s._ui?.amountGross ?? s._ui?.amountNet ?? s?.final_amount ?? s?.total_amount ?? 0) || 0;

      const key = `${client}||${fuel}`;
      const cur = agg.get(key) || { client, fuel, gallons: 0, gross: 0 };
      cur.gallons += gallons;
      cur.gross   += gross;
      agg.set(key, cur);
    }
    return Array.from(agg.values()).map(r => ({
      client: r.client,
      fuel: r.fuel,
      gallons: Number(r.gallons.toFixed(2)),
      gross: Number(r.gross.toFixed(2)),
    }));
  }, [filteredRecentSales]);
  /* <<< FIN NUEVO >>> */

  const PAGE_SIZE = 5;
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [resumenShift]);
  const totalPages = Math.max(1, Math.ceil(filteredRecentSales.length / PAGE_SIZE));
  const pageSales = useMemo(
    () => filteredRecentSales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredRecentSales, currentPage]
  );

  /* RESUMEN (KPIs derecha) */
  type Bucket = { gal: number; sol: number };
  const salesForResumen = filteredRecentSales;

  const resumen = useMemo(() => {
    const baseNoCredit: Record<'Regular'|'Premium'|'Diesel', Bucket> = {
      Regular: { gal: 0, sol: 0 }, Premium: { gal: 0, sol: 0 }, Diesel: { gal: 0, sol: 0 },
    };
    const baseCredit: Record<'Regular'|'Premium'|'Diesel', Bucket> = {
      Regular: { gal: 0, sol: 0 }, Premium: { gal: 0, sol: 0 }, Diesel: { gal: 0, sol: 0 },
    };

    for (const s of salesForResumen) {
      const prod = (s._ui?.productName ?? 'Regular') as string;
      const key: 'Regular'|'Premium'|'Diesel' = prod === 'Premium' ? 'Premium' : prod === 'Diesel' ? 'Diesel' : 'Regular';
      const gal = Number(s._ui?.gallons ?? 0) || 0;
      const sol = Number(s._ui?.amountGross ?? s._ui?.amountNet ?? s.final_amount ?? s.total_amount ?? 0) || 0;

      const label = String(s?._ui?.paymentLabel ?? '').toLowerCase();
      if (label.includes('crédito') || label.includes('credito') || label.includes('credit')) {
        baseCredit[key].gal += gal; baseCredit[key].sol += sol;
      } else {
        baseNoCredit[key].gal += gal; baseNoCredit[key].sol += sol;
      }
    }

    const totalIngresos = baseNoCredit.Regular.sol + baseNoCredit.Premium.sol + baseNoCredit.Diesel.sol;
    const totalGalNoCredit = baseNoCredit.Regular.gal + baseNoCredit.Premium.gal + baseNoCredit.Diesel.gal;

    const creditSales = salesForResumen.filter((s) => {
      const l = String(s?._ui?.paymentLabel ?? '').toLowerCase();
      return l.includes('credito') || l.includes('crédito') || l.includes('credit');
    });
    const creditCount = creditSales.length;
    const creditTotal = baseCredit.Regular.sol + baseCredit.Premium.sol + baseCredit.Diesel.sol;

    return { baseNoCredit, baseCredit, totalIngresos, totalGalNoCredit, transacciones: salesForResumen.length, creditCount, creditTotal };
  }, [salesForResumen]);

  /* CAJA */
  const [isCajaAbierta, setIsCajaAbierta] = useState(false);
  const [cajaHoy, setCajaHoy] = useState<any>(null);
  const [shiftCaja, setShiftCaja] = useState<ShiftName>(turnoActivo);
  const [touchedMontoInicial, setTouchedMontoInicial] = useState(false);
  const [touchedMontoFisico, setTouchedMontoFisico] = useState(false);

  useEffect(() => {
    const flag = readCurrentOpenFlag(storageDay);
    let opened = false;
    try {
      const keys = (shiftNames.length ? shiftNames : [turnoActivo]).map(s => openStateKey(storageDay, s));
      opened = keys.some(k => localStorage.getItem(k) === '1') || !!flag;
    } catch {}
    setIsCajaAbierta(opened);
    if (flag?.shift) setShiftCaja(flag.shift);
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      const keys = (shiftNames.length ? shiftNames : [turnoActivo]).map(s => openStateKey(storageDay, s));
      const watch = [CURRENT_OPEN_FLAG, ...keys];
      if (watch.includes(e.key || '')) {
        const cur = readCurrentOpenFlag(storageDay);
        const anyOpen = keys.some(k => localStorage.getItem(k) === '1') || !!cur;
        setIsCajaAbierta(anyOpen);
        if (cur?.shift) setShiftCaja(cur.shift);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageDay, turnoActivo]);

  const fetchCajaToday = async () => {
    const flag = readCurrentOpenFlag(storageDay);

    try {
      let openShift: ShiftName | null = null;
      try {
        const dayRaw = await cashBoxService.historyDay(storageDay);
        const events: any[] = Array.isArray((dayRaw as any)?.events) ? (dayRaw as any).events : [];
        // >>> FIX: calcular el turno por la hora del evento (ignorar label del backend si está mal)
        const norm = events
          .map((e: any) => {
            const labelFromServer = cleanShiftLabel(
              String(e?.shift_name ?? e?.shift ?? e?.turno ?? e?.name ?? '')
            );
            const computed = shiftFromTimestamp(e?.timestamp, hours);
            return {
              ...e,
              shift: (computed ?? labelFromServer ?? '—') as ShiftName,
            };
          })
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const last = norm[norm.length - 1];
        if (last && String(last.type || '').toLowerCase() === 'open') {
          openShift = String(last.shift) as ShiftName;
        }
      } catch {}

      const usedShift: ShiftName = openShift ?? turnoActivo;
      const dateStr = toYMD(new Date(storageDay + 'T00:00:00'));

      const data = await cashBoxService.getToday({ date: dateStr, shift: shiftForApi(usedShift) as any });
      const d: any = data as any;
      const normalized = { ...d, id: d?.id ?? d?.session_id ?? d?.cash_box_session_id ?? d?.sessionId };
      setCajaHoy(normalized);

      const serverOpen =
        normalized?.status === 'abierta' || normalized?.status === 'open' ||
        normalized?.is_closed === false || (!!normalized?.opened_at && !normalized?.closed_at);

      if (serverOpen) {
        setIsCajaAbierta(true);
        setShiftCaja(usedShift);

        const openAmt = Number(normalized?.opening_amount);
        if (Number.isFinite(openAmt) && openAmt >= 0) {
          updateRef.current({ monto_inicial: openAmt, monto_inicial_anterior: openAmt });
        }
        if (!touchedMontoFisico) updateRef.current({ monto_fisico: 0 });

        try {
          localStorage.setItem(openStateKey(storageDay, usedShift), '1');
          localStorage.setItem(CURRENT_OPEN_FLAG, JSON.stringify({ day: storageDay, shift: usedShift, ts: new Date().toISOString() }));
        } catch {}
      } else {
        setIsCajaAbierta(false);
        setShiftCaja(turnoActivo);
        clearLocalOpenFlagsForDay(storageDay, shiftNames);
      }
    } catch {
      const cur = readCurrentOpenFlag(storageDay);
      const anyOpen = (() => {
        try {
          const keys = (shiftNames.length ? shiftNames : [turnoActivo]).map(s => openStateKey(storageDay, s));
          return keys.some(k => localStorage.getItem(k) === '1') || !!cur;
        } catch { return !!cur; }
      })();

      setIsCajaAbierta(anyOpen);
      if (cur?.shift) setShiftCaja(cur.shift);
      if (anyOpen && !touchedMontoFisico) updateRef.current({ monto_fisico: 0 });
    }
  };
  useEffect(() => { fetchCajaToday(); }, [turnoActivo, storageDay, hours]); // <<< incluye hours

  /* Parche de envío de ventas con turno abierto */
  useEffect(() => {
    try {
      const ss: any = saleService as any;
      if (ss && !ss.__openShiftPatched) {
        const wrap = (orig: Function) => async (payload: any, ...rest: any[]) => {
          const cur = readCurrentOpenFlag(storageDay);
          const p: any = { ...(payload || {}) };
          if (cur?.shift && !p.shift_name) p.shift_name = shiftForApi(cur.shift);
          if (!p.day_date) p.day_date = toYMD(new Date(storageDay + 'T00:00:00'));
          try {
            return await orig(p, ...rest);
          } catch (e: any) {
            const status = e?.response?.status ?? e?.statusCode;
            const msg = String(e?.response?.data?.message ?? e?.message ?? '').toLowerCase();
            if (status === 403 && msg.includes('no está abierta')) {
              const cur2 = readCurrentOpenFlag(storageDay);
              const retry: any = { ...p };
              if (cur2?.shift) retry.shift_name = shiftForApi(cur2.shift);
              retry.day_date = toYMD(new Date(storageDay + 'T00:00:00'));
              return await orig(retry, ...rest);
            }
            throw e;
          }
        };
        const candidates = ['createSale', 'create', 'save', 'register', 'add'];
        candidates.forEach((k) => {
          if (typeof ss[k] === 'function') {
            const orig = ss[k].bind(ss);
            ss[k] = wrap(orig);
          }
        });
        ss.__openShiftPatched = true;
      }
    } catch (err) {
      console.warn('No se pudo parchear saleService para forzar shift abierto:', err);
    }
  }, [storageDay]);

  useEffect(() => {
    if (isCajaAbierta) return;
    if (cashControl.monto_inicial != null && touchedMontoInicial) return;

    if (turnoActivo === firstShiftName) {
      if (!touchedMontoInicial) updateRef.current({ monto_inicial: 0, monto_inicial_anterior: 0 });
      if (firstShiftName) writeSuggest(storageDay, firstShiftName, null);
      return;
    }

    const s = readSuggest(storageDay, turnoActivo);
    if (s != null && !touchedMontoInicial && (cashControl.monto_inicial == null || cashControl.monto_inicial === 0)) {
      updateRef.current({ monto_inicial: s, monto_inicial_anterior: s });
    }
  }, [turnoActivo, storageDay, isCajaAbierta]);

  const [historial, setHistorial] = useState<CajaHistoryDay[]>([]);
  const todayKey = storageDay;

  const fetchHistorial = async () => {
    try {
      const dayRaw = await cashBoxService.historyDay(storageDay);
      const normalize = (arr: CajaHistoryDay[]) =>
        arr.map((d) => ({
          ...d,
          events: (d?.events ?? []).map((e: any) => {
            const labelFromServer = cleanShiftLabel(
              String(
                e?.shift_name ??
                e?.shift ??
                e?.turno ??
                e?.name ??
                ''
              )
            );
            // >>> FIX: turno por timestamp con horarios de Settings
            const computed = shiftFromTimestamp(e?.timestamp, hours);
            return {
              ...e,
              shift: (computed ?? labelFromServer ?? '—') as ShiftName,
            };
          }),
        }));

      const day = normalize([dayRaw])[0];
      setHistorial([day]);
      saveHistory([day]);
      return;
    } catch (e) {
      console.warn('Historial: usando fallback local por error:', e);
      const normalize = (arr: CajaHistoryDay[]) =>
        arr.map((d) => ({
          ...d,
          events: (d?.events ?? []).map((e: any) => ({
            ...e,
            // >>> FIX (fallback): también computar por timestamp aquí
            shift: (shiftFromTimestamp(e?.timestamp, hours) ??
                    cleanShiftLabel(String(e?.shift_name ?? e?.shift ?? e?.turno ?? e?.name ?? '')) ??
                    '—') as ShiftName,
          })),
        }));
      setHistorial(normalize(loadHistory()));
    }
  };
  const eventosDeHoy: CajaEvent[] = useMemo(() => {
    const day = historial.find((d) => d.dateKey === todayKey);
    return [...(day?.events ?? [])];
  }, [historial, todayKey]);
  useEffect(() => { fetchHistorial(); }, [turnoActivo, storageDay, hours]); // <<< incluye hours

  const estadoTurno: 'ACTIVO' | 'CERRADO' | 'SIN ABRIR' = useMemo(() => {
    if (isCajaAbierta) return 'ACTIVO';
    if (cajaHoy?.status === 'cerrada') return 'CERRADO';
    return 'SIN ABRIR';
  }, [isCajaAbierta, cajaHoy]);

  /* TOTALES / MÉTODOS */
  const salesInActiveShift = useMemo(() => {
    const { from: f, to: t } = getRange(shiftCaja);
    return recentSales.filter((s: any) => {
      const ts = new Date(s?.sale_timestamp ?? s?.timestamp ?? 0);
      return Number.isFinite(ts.getTime()) && ts >= f && ts < t;
    });
  }, [recentSales, shiftCaja, now]);

  const ventasBrutasNoCredito = useMemo(
    () => calcTotalVentasTurnoBruto(
      salesInActiveShift.filter((s) => {
        const label = String(s?._ui?.paymentLabel ?? '').toLowerCase();
        return !(label.includes('credito') || label.includes('crédito') || label.includes('credit'));
      })
    ),
    [salesInActiveShift]
  );

  const totalsByMethod = useMemo(() => buildTotalsByMethod(salesInActiveShift), [salesInActiveShift]);

  const handleAbrirCaja = async () => {
    const monto = Number(cashControl.monto_inicial ?? 0) || 0;
    const nombre = empleadoActual?.full_name || empleadoActual?.username || 'Operador';
    const userId = Number(empleadoActual?.user_id ?? empleadoActual?.id ?? 0);
    const key = openStateKey(storageDay, turnoActivo);

    try {
      const created = await cashBoxService.open({
        day_date: toYMD(from),
        shift_name: shiftForApi(turnoActivo) as any,
        opening_amount: monto,
        opened_by: userId || undefined,
        opened_by_name: nombre,
      });
      setCajaHoy({ ...created, status: 'abierta' });
      setIsCajaAbierta(true);
      setShiftCaja(turnoActivo);
      try {
        localStorage.setItem(key, '1');
        localStorage.setItem(CURRENT_OPEN_FLAG, JSON.stringify({ day: storageDay, shift: turnoActivo, ts: new Date().toISOString() }));
      } catch {}
      await fetchHistorial();
    } catch (e) {
      console.warn('No se pudo abrir en backend:', e);
      setIsCajaAbierta(true);
      setShiftCaja(turnoActivo);
      try {
        localStorage.setItem(key, '1');
        localStorage.setItem(CURRENT_OPEN_FLAG, JSON.stringify({ day: storageDay, shift: turnoActivo, ts: new Date().toISOString() }));
      } catch {}
    }

    updateRef.current({
      monto_inicial: monto,
      monto_inicial_anterior: monto,
      ventas_actuales: ventasBrutasNoCredito,
      monto_fisico: 0,
    });
  };

  const handleCerrarCaja = async () => {
    const ventasTurnoNeto = calcTotalVentasTurno(salesInActiveShift);

    const nombre = empleadoActual?.full_name || empleadoActual?.username || 'Operador';
    const userId = Number(empleadoActual?.user_id ?? empleadoActual?.id ?? 0);
    const sessionId = Number(
      cajaHoy?.id ?? cajaHoy?.session_id ?? cajaHoy?.cash_box_session_id ?? cajaHoy?.sessionId ?? 0
    );
    const key = openStateKey(storageDay, shiftCaja);

    const nxt = nextShift(shiftCaja, shiftNames);
    const baseDay = new Date(storageDay + 'T00:00:00');
    const nextDay = toLocalYMD(new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate() + 1));
    // Si el siguiente turno es el primer turno del ciclo, avanzamos de día
    const dayForNext = (firstShiftName && nxt === firstShiftName) ? nextDay : storageDay;

    try {
      if (!sessionId) throw new Error('No hay sesión creada (id). Abre caja primero.');

      const closingAmt = Number(cashControl.monto_fisico ?? 0) || 0;
      writeSuggest(dayForNext, nxt, closingAmt);

      const payload = {
        id: sessionId,
        is_closed: true,
        closing_amount: closingAmt,
        sales_amount: ventasTurnoNeto,
        notes: cashControl.observaciones,
        closed_by: userId || undefined,
        closed_by_name: nombre,
      };

      await cashBoxService.close(payload);

      setIsCajaAbierta(false);
      setCajaHoy((prev: any) => ({ ...(prev || {}), status: 'cerrada' }));
      try { localStorage.removeItem(key); localStorage.removeItem(CURRENT_OPEN_FLAG); } catch {}

      updateRef.current({ monto_inicial: closingAmt, monto_inicial_anterior: closingAmt });
      setTouchedMontoInicial(true);
      setShiftCaja(turnoActivo);
      await fetchHistorial();
    } catch (e) {
      console.warn('No se pudo cerrar en backend:', e);
      setIsCajaAbierta(false);
      try { localStorage.removeItem(key); localStorage.removeItem(CURRENT_OPEN_FLAG); } catch {}

      const closingAmt = Number(cashControl.monto_fisico ?? 0) || 0;
      writeSuggest(dayForNext, nxt, closingAmt);
      updateRef.current({ monto_inicial: closingAmt, monto_inicial_anterior: closingAmt });
      setTouchedMontoInicial(true);
      setShiftCaja(turnoActivo);
    }
  };

  const getAmountForBreakdown = (s: any) =>
    Number(s?._ui?.amountGross ?? s?._ui?.amountNet ?? s?.final_amount ?? s?.total_amount ?? 0) || 0;

  const dynamicBreakdown = useMemo(() => {
    if (!pmCatalog?.length) return {} as Record<string, number>;
    const sums: Record<string, number> = {};
    for (const s of salesInActiveShift) {
      const label = String(s?._ui?.paymentLabel ?? '').trim();
      if (!label) continue;
      sums[label] = (sums[label] ?? 0) + getAmountForBreakdown(s);
    }
    for (const k of Object.keys(sums)) sums[k] = Number(sums[k].toFixed(2));
    return sums;
  }, [salesInActiveShift, pmCatalog]);

  const labelEfectivo = useMemo(() => {
    for (const m of pmCatalog || []) {
      const name = String(m?.method_name ?? m?.name ?? '').trim();
      const low = name.toLowerCase();
      if (low.includes('efectivo') || low === 'cash' || low.includes('contado')) return name;
    }
    return '';
  }, [pmCatalog]);

  const montoEnEfectivo = useMemo(() => {
    if (labelEfectivo) {
      const exact = (dynamicBreakdown as any)[labelEfectivo];
      if (typeof exact === 'number') return exact;
      const found = Object.entries(dynamicBreakdown).find(([k]) => k.toLowerCase() === labelEfectivo.toLowerCase());
      if (found) return Number(found[1] || 0);
    }
    const byName = Object.entries(dynamicBreakdown).find(([k]) => /efectivo|cash|contado/i.test(k));
    if (byName) return Number(byName[1] || 0);
    return Number(totalsByMethod.efectivo ?? 0) || 0;
  }, [dynamicBreakdown, labelEfectivo, totalsByMethod.efectivo]);

  /* ====== UI ====== */
  const [openHistModal, setOpenHistModal] = useState(false);
  const [openDetalle, setOpenDetalle] = useState(false);
  const [showCreditPayments, setShowCreditPayments] = useState(false);
  const [creditPayments, setCreditPayments] = useState<CreditPaymentItem[]>([]);
  const [loadingCreditPayments, setLoadingCreditPayments] = useState(false);
  const [creditPage, setCreditPage] = useState(1);
  const CREDIT_PAGE_SIZE = 5;
  const [creditTotal, setCreditTotal] = useState(0);

  const refreshCreditPayments = async () => {
    setLoadingCreditPayments(true);
    try {
      const res = await paymentsService.getRecentCreditPayments(creditPage, CREDIT_PAGE_SIZE);
      setCreditPayments(res.items || []);
      setCreditTotal(Number(res.total || 0));
    } catch (e) {
      console.warn('No se pudieron cargar pagos de créditos:', e);
      setCreditPayments([]);
      setCreditTotal(0);
    } finally {
      setLoadingCreditPayments(false);
    }
  };
  useEffect(() => { if (showCreditPayments) refreshCreditPayments(); }, [showCreditPayments, creditPage]);

  const creditTotalPages = Math.max(1, Math.ceil((creditTotal || 0) / CREDIT_PAGE_SIZE));
  const dayLabel = useMemo(() => new Date(storageDay + 'T00:00:00').toLocaleDateString('es-PE'), [storageDay]);

  /* ➕ Tabs para el panel central */
  const [activeTab, setActiveTab] = useState<'estado' | 'ventas' | 'historial'>('estado');

  /* >>> CAMBIO MÍNIMO: mostrar turno desde backend si la caja está abierta <<< */
  const displayShift = useMemo(
    () => cleanShiftLabel(isCajaAbierta ? (shiftCaja as string) : (turnoActivo as string)),
    [isCajaAbierta, shiftCaja, turnoActivo]
  );

  /* === NUEVO: helper + agregados por producto para el modal === */
  const buildRowsByProduct = (sales: any[]) => {
    const map = new Map<string, { gal: number; sol: number }>();
    for (const s of sales) {
      const name = String(s?._ui?.productName ?? '—') || '—';
      const gal = Number(s?._ui?.gallons ?? 0) || 0;
      const sol = Number(s?._ui?.amountGross ?? s?._ui?.amountNet ?? s?.final_amount ?? s?.total_amount ?? 0) || 0;
      const acc = map.get(name) || { gal: 0, sol: 0 };
      acc.gal += gal; acc.sol += sol; map.set(name, acc);
    }
    const rows = Array.from(map, ([fuel, v]) => ({
      fuel, gallons: Number(v.gal.toFixed(2)), gross: Number(v.sol.toFixed(2)),
    }));
    const totals = rows.reduce(
      (a, r) => ({ gallons: a.gallons + r.gallons, gross: a.gross + r.gross }),
      { gallons: 0, gross: 0 }
    );
    return { rows, totals };
  };

  const salesNoCredit = useMemo(
    () => filteredRecentSales.filter(s => !/(cr[eé]dito|credit)/i.test(String(s?._ui?.paymentLabel ?? ''))),
    [filteredRecentSales]
  );
  const salesCredit = useMemo(
    () => filteredRecentSales.filter(s =>  /(cr[eé]dito|credit)/i.test(String(s?._ui?.paymentLabel ?? ''))),
    [filteredRecentSales]
  );

  const rowsNoCreditAgg = useMemo(() => buildRowsByProduct(salesNoCredit), [salesNoCredit]);
  const rowsCreditAgg   = useMemo(() => buildRowsByProduct(salesCredit),   [salesCredit]);

return (
  <div className="relative min-h-screen w-full overflow-x-hidden">
    {/* Fondo decorativo */}
    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(253,186,116,0.08),transparent),radial-gradient(900px_500px_at_100%_10%,rgba(59,130,246,0.06),transparent)]" />

    {/* Barra superior */}
    <div className="sticky top-0 z-40 border-b border-white/10 bg-[#0a1020]/90 backdrop-blur supports-backdrop-blur:backdrop-blur-sm">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-2 px-3 py-2 sm:px-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="shrink-0 rounded-md bg-indigo-600/90 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-white shadow-sm">
            Turno: {displayShift}
          </span>

          <span
            className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] sm:text-xs font-bold ring-1 ${
              estadoTurno === 'ACTIVO'
                ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                : estadoTurno === 'CERRADO'
                ? 'bg-slate-500/20 text-slate-300 ring-slate-400/30'
                : 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
            }`}
          >
            {estadoTurno}
          </span>

          {/* ⏰ Horario del turno */}
          <span className="hidden md:inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-800/80 px-2.5 py-1 text-[10px] sm:text-xs text-slate-200">
            <Clock className="h-3.5 w-3.5 text-amber-300" />
            {hours?.[turnoActivo]?.start} – {hours?.[turnoActivo]?.end}
          </span>

          <span className="hidden min-w-0 md:inline-flex items-center gap-1 truncate rounded-md bg-slate-800/80 px-2.5 py-1 text-[10px] sm:text-xs text-slate-200">
            <CalendarDays className="h-3.5 w-3.5 text-orange-300" />
            <span className="truncate">{dayLabel}</span>
          </span>

          <span className="hidden min-w-0 md:inline-flex items-center gap-1 truncate rounded-md bg-slate-800/80 px-2.5 py-1 text-[10px] sm:text-xs text-slate-200">
            <User className="h-3.5 w-3.5 text-sky-300" />
            <span className="truncate">{empleadoActual?.full_name || empleadoActual?.username || 'Operador'}</span>
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setNow(new Date()); refreshRecentSales(); fetchCajaToday(); fetchHistorial(); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] sm:text-xs text-white hover:bg-slate-700"
            aria-label="Actualizar datos"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Actualizar
          </button>
          <button
            onClick={() => setOpenHistModal(true)}
            className="rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-white hover:bg-slate-700"
          >
            Ver historial
          </button>
        </div>
      </div>
    </div>

    {/* === FILA SUPERIOR ===
        - En pantallas pequeñas: 1 columna (no se aplasta nada)
        - En medianas: 2 columnas (la tercera tarjeta baja)
        - En grandes: 3 columnas */}
    <div className="mx-auto max-w-screen-2xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6 lg:space-y-8 lg:px-6 lg:py-10">
      <section className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
        {/* Izquierda: Apertura/Cierre */}
        <div className="rounded-2xl border border-white/10 bg-[#0F172A]/90 p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.25)]">
          <header className="mb-4">
            <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-300">
              {isCajaAbierta ? 'Cierre de caja' : 'Apertura de caja'}
            </h3>
            <div className="mt-2 h-px w-full bg-white/10" />
          </header>

          {/* Apertura */}
          {!isCajaAbierta && (
            <fieldset className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] sm:text-xs font-medium text-slate-400">Monto inicial</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={
                    cashControl.monto_inicial == null ? '' :
                    (cashControl.monto_inicial === 0 && !touchedMontoInicial) ? '' :
                    String(cashControl.monto_inicial)
                  }
                  onChange={(e) => {
                    if (!touchedMontoInicial) setTouchedMontoInicial(true);
                    const raw = e.currentTarget.value;
                    updateRef.current({ monto_inicial: raw === '' ? undefined : parseFloat(raw) || 0 });
                  }}
                  className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="min-w-0">
                <label className="mb-1 block text-[11px] sm:text-xs font-medium text-slate-400">Responsable</label>
                <div className="w-full overflow-hidden rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm sm:text-base text-slate-100">
                  <span className="block truncate">{empleadoActual?.full_name || empleadoActual?.username || '—'}</span>
                </div>
              </div>

              <button
                onClick={handleAbrirCaja}
                className="w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-600"
              >
                Abrir caja
              </button>
            </fieldset>
          )}

          {/* Cierre */}
          {isCajaAbierta && (
            <fieldset className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] sm:text-xs font-medium text-slate-400">Monto en efectivo</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={montoEnEfectivo.toFixed(2)}
                  readOnly
                  className="w-full cursor-not-allowed rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm sm:text-base text-slate-100"
                />
                <p className="mt-1 text-[10px] sm:text-[11px] text-slate-400">
                  Se calcula automáticamente con las ventas en <strong>Efectivo</strong>.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] sm:text-xs font-medium text-slate-400">En caja</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={String(cashControl.monto_fisico ?? 0)}
                  onChange={(e) => {
                    if (!touchedMontoFisico) setTouchedMontoFisico(true);
                    const raw = e.currentTarget.value;
                    const val = raw === '' ? 0 : parseFloat(raw) || 0;
                    updateRef.current({ monto_fisico: val });
                  }}
                  className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="mt-1 text-[10px] sm:text-[11px] text-slate-400">Ingresa manualmente el efectivo que quedó en caja.</p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] sm:text-xs font-medium text-slate-400">Observaciones</label>
                <textarea
                  rows={5}
                  placeholder="Notas del cierre..."
                  value={cashControl.observaciones ?? ''}
                  onChange={(e) => updateRef.current({ observaciones: e.currentTarget.value })}
                  className="w-full min-w-0 resize-y rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                onClick={handleCerrarCaja}
                className="w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-600"
              >
                Cerrar caja
              </button>

              <div className="mt-3 text-center text-[11px] font-semibold text-emerald-400">
                Caja abierta — bloqueada hasta cierre
              </div>
            </fieldset>
          )}
        </div>

        {/* Centro: Estado actual */}
        <div className="min-w-0 rounded-2xl border border-white/10 bg-[#0F172A]/90 p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.25)]">
          <h3 className="mb-4 text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-300">Estado actual</h3>

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="rounded-lg border border-white/10 bg-slate-900/50 p-3 sm:p-4">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-400">Monto inicial</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-white">
                S/ {Number(isCajaAbierta ? (cashControl.monto_inicial ?? 0) : 0).toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-slate-900/50 p-3 sm:p-4">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-400">Ventas actuales</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-white">S/ {ventasBrutasNoCredito.toFixed(2)}</div>
            </div>

            <div className="sm:col-span-2 rounded-lg border border-white/10 bg-slate-900/50 p-3 sm:p-4">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-400">Total en caja</div>
              <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-400">
                S/ {Number(((isCajaAbierta ? Number(cashControl.monto_inicial ?? 0) : 0) + Number(montoEnEfectivo)).toFixed(2))}
              </div>
            </div>
          </div>

          {/* Desglose por método */}
          <div className="mt-4">
            <div className="mb-2 text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-400">
              Desglose por método
            </div>

            {pmCatalog?.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
                {pmCatalog.map((m: any) => {
                  const label = String(m?.method_name ?? m?.name ?? '').trim() || '—';
                  const sum = Number((dynamicBreakdown as any)[label] ?? 0);
                  return (
                    <div
                      key={String(m?.payment_method_id ?? m?.id ?? label)}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/50 p-3"
                    >
                      <span className="text-sm text-slate-300 break-words hyphens-auto">{label}</span>
                      <span className="text-sm font-semibold text-white">S/ {sum.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-slate-900/50 p-3 text-sm text-slate-300">
                No hay métodos de pago activos configurados.
              </div>
            )}
          </div>
        </div>
        {/* Derecha: Resumen */}
        <aside className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-white">Resumen de ventas</h3>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white">En vivo</span>

              <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700/60 bg-slate-800/60 p-0.5">
                {(shiftNames.length ? shiftNames : [turnoActivo]).map((name) => {
                  const active = resumenShift === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setResumenShift(name)}
                      className={`px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition ${
                        active ? 'bg-slate-900 text-white shadow' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <span className="block max-w-[9ch] truncate sm:max-w-none">{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 px-4 sm:px-5 py-4 sm:py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-400">Ingresos brutos</div>
                  <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-400">
                    S/ {resumen.totalIngresos.toFixed(2)}
                  </div>
                </div>
                <DollarSign className="h-6 w-6 sm:h-7 sm:w-7 opacity-80 text-emerald-400" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 px-4 sm:px-5 py-4 sm:py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-400">Transacciones</div>
                  <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-white">{resumen.transacciones}</div>
                </div>
                <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7 opacity-80 text-sky-300" />
              </div>
            </div>

            <button
              onClick={() => setOpenDetalle(true)}
              className="w-full rounded-2xl border border-slate-700/60 bg-slate-800/60 px-5 py-3 sm:py-4 text-sm sm:text-base font-semibold text-white hover:bg-slate-700"
            >
              Información detallada
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-700/60 bg-slate-800/60 p-4">
            <div className="mb-2 text-[10px] sm:text-xs uppercase tracking-wide text-slate-400">Créditos del turno</div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xl sm:text-2xl font-extrabold text-white">{resumen.creditCount}</div>
                <div className="text-[10px] sm:text-xs text-slate-400">créditos</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-400">Monto</div>
                <div className="text-lg sm:text-xl font-bold text-emerald-400">S/ {resumen.creditTotal.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* === FILA INFERIOR: VENTAS RECIENTES + HISTORIAL ===
          - En móvil una sola columna (no tabla dura)
          - En >= lg se divide 2:1 */}
      <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Ventas recientes */}
        <div className="min-w-0 lg:col-span-2 rounded-2xl border border-white/10 bg-[#0F172A]/90 p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.25)]">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-300">Ventas recientes</h3>

            <div className="flex flex-wrap items-center gap-2">
              {!showCreditPayments && (
                <button
                  onClick={refreshRecentSales}
                  className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-[11px] sm:text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                  disabled={loadingRecentSales}
                  title="Actualizar"
                >
                  <RefreshCcw size={14} className={loadingRecentSales ? 'animate-spin' : ''} />
                  {loadingRecentSales ? 'Actualizando…' : 'Actualizar'}
                </button>
              )}

              <button
                onClick={() => setShowCreditPayments((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] sm:text-xs font-semibold ${
                  showCreditPayments ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
                title={showCreditPayments ? 'Ver ventas' : 'Ver pagos de créditos'}
              >
                {showCreditPayments ? 'Ver ventas' : 'Pagos de créditos'}
              </button>
            </div>
          </div>

          {showCreditPayments ? (
            <>
              <div className="hidden sm:grid grid-cols-5 gap-2 border-b border-slate-700 pb-2 text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-400">
                <div className="col-span-2">Cliente</div>
                <div>Método</div>
                <div className="text-center">Monto</div>
                <div className="text-right">Fecha</div>
              </div>

              <div className="divide-y divide-slate-700">
                {creditPayments.length === 0 && (
                  <div className="py-6 text-center text-slate-400">
                    {loadingCreditPayments ? 'Cargando pagos…' : 'No hay pagos de créditos'}
                  </div>
                )}

                {creditPayments.map((p) => {
                  const amount = Number(p.amount ?? 0).toFixed(2);
                  const dateStr = p.timestamp ? fmtDateTime(p.timestamp) : '—';
                  const status = p.status || 'completed';
                  const clientName = p.clientName || 'Sin cliente';
                  return (
                    <div key={p.paymentId} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-5 sm:items-center">
                      <div className="col-span-2 flex min-w-0 items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-600 text-xs font-bold text-white">
                          {String(clientName).charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div className="min-w-0 text-sm text-slate-300">
                          <div className="truncate font-medium text-white">{clientName}</div>
                          <div className="text-xs text-slate-400">Pago de crédito #{p.creditId ?? '—'}</div>
                        </div>
                      </div>

                      <div className="min-w-0 truncate text-sm text-slate-300">{p.method || '—'}</div>

                      <div className="text-center">
                        <div className="text-base text-green-400">S/ {amount}</div>
                        <div className="mt-0.5 text-[10px] sm:text-[11px] text-slate-400">ID pago: {p.paymentId}</div>
                      </div>

                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <span className="text-xs text-slate-400">{dateStr}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            status === 'completed'
                              ? 'bg-green-700 text-white'
                              : status === 'pending'
                              ? 'bg-yellow-700 text-white'
                              : 'bg-red-700 text-white'
                          }`}
                        >
                          {status === 'completed' ? 'Completado' : status === 'pending' ? 'Pendiente' : 'Anulado'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {creditTotal > CREDIT_PAGE_SIZE && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1 text-[11px] sm:text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                    disabled={creditPage === 1 || loadingCreditPayments}
                    onClick={() => setCreditPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>

                  {Array.from({ length: Math.max(1, Math.ceil((creditTotal || 0) / CREDIT_PAGE_SIZE)) }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setCreditPage(n)}
                      className={`rounded-md border px-3 py-1 text-[11px] sm:text-xs ${
                        creditPage === n
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                      disabled={loadingCreditPayments}
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1 text-[11px] sm:text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                    disabled={creditPage === creditTotalPages || loadingCreditPayments}
                    onClick={() => setCreditPage((p) => Math.min(creditTotalPages, p + 1))}
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Cabecera tipo tabla solo en ≥ sm */}
              <div className="hidden sm:grid grid-cols-5 gap-2 border-b border-slate-700 pb-2 text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-400">
                <div className="col-span-2">Cliente / Surtidor</div>
                <div>Producto</div>
                <div className="text-center">Monto</div>
                <div className="text-right">Fecha</div>
              </div>

              {/* Lista adaptable */}
              <div className="divide-y divide-slate-700">
                {pageSales.length === 0 && (
                  <div className="py-6 text-center text-slate-400">
                    {loadingRecentSales ? 'Cargando ventas…' : 'No hay ventas en este turno'}
                  </div>
                )}

                {pageSales.map((sale: any) => {
                  const key = sale.sale_id || sale.id;
                  const clientName =
                    sale._ui?.clientName ||
                    sale.client?.name ||
                    [sale.client?.first_name, sale.client?.last_name].filter(Boolean).join(' ') ||
                    sale.client_name ||
                    'Sin cliente';

                  const productName = sale._ui?.productName ?? '—';
                  const pumpName = sale._ui?.pumpName ?? '—';
                  const gallons = sale._ui?.gallons != null ? Number(sale._ui.gallons).toFixed(2) : '—';
                  const paidGross = Number(sale._ui?.amountGross ?? 0).toFixed(2);
                  const dateTimeStr = sale._ui?.dateTime ?? fmtDateTime(sale.sale_timestamp);
                  const status = sale.status || 'completed';
                  const discountText = sale._ui?.discountText ?? 'Sin descuento';
                  const paymentLabel = sale._ui?.paymentLabel ?? '—';
                  const obsText = cleanNotes(sale?.notes);

                  return (
                    <div key={key} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-5 sm:items-center">
                      {/* Cliente / surtidor */}
                      <div className="col-span-2 flex min-w-0 items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-600 text-xs font-bold text-white">
                          {String(clientName).charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div className="min-w-0 text-sm text-slate-300">
                          <div className="truncate font-medium text-white">{clientName}</div>
                          <div className="text-xs text-slate-400">
                            <span className="truncate">{pumpName}</span>
                            {sale._ui?.nozzleNumber ? ` · Boquilla ${sale._ui.nozzleNumber}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Producto */}
                      <div className="min-w-0 text-sm text-slate-300">
                        <span className="break-words">{productName}</span>
                        {' · '}
                        {gallons !== '—' ? `${gallons} gal` : '—'}
                      </div>

                      {/* Monto */}
                      <div className="text-center">
                        <div className="text-base text-green-400">S/ {paidGross}</div>
                        <div className="mt-0.5 text-[10px] sm:text-[11px] text-slate-400">
                          <span className="break-words">{discountText}</span> · Pago:{' '}
                          <span className="break-words">{paymentLabel}</span>
                        </div>
                      </div>

                      {/* Fecha + chips */}
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <span className="text-xs text-slate-400">{dateTimeStr}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              status === 'completed'
                                ? 'bg-green-700 text-white'
                                : status === 'pending'
                                ? 'bg-yellow-700 text-white'
                                : 'bg-red-700 text-white'
                            }`}
                          >
                            {status === 'completed' ? 'Completada' : 'Pendiente'}
                          </span>

                          {obsText && (
                            <span
                              title={obsText}
                              className="cursor-help rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-semibold text-white"
                            >
                              Obs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredRecentSales.length > 5 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1 text-[11px] sm:text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setCurrentPage(n)}
                      className={`rounded-md border px-3 py-1 text-[11px] sm:text-xs ${
                        currentPage === n
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1 text-[11px] sm:text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ------- BLOQUE: HISTORIAL DE CAJA --------------------------- */}
        <div className="rounded-2xl border border-white/10 bg-[#0F172A]/90 p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.25)]">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-300">
              Historial de caja — Hoy ({new Date().toLocaleDateString('es-PE')})
            </h3>

            <button
              type="button"
              onClick={() => setOpenHistModal(true)}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-white hover:bg-slate-700"
            >
              Ver todos
            </button>
          </div>

          <ul className="divide-y divide-white/10">
            {eventosDeHoy.length === 0 && (
              <li className="px-2 py-6 text-center text-slate-400">Aún no hay movimientos hoy.</li>
            )}

            {eventosDeHoy.map((ev, idx) => {
              const dt = new Date(ev.timestamp);
              const hora = dt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' });
              const isOpen = expandedIndex === idx;
              const isApertura = String(ev.type).toLowerCase() === 'open';

              return (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full rounded-md px-2 py-3 text-left transition hover:bg-slate-900/50 focus:outline-none"
                  >
                    <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[auto,1fr,auto,auto]">
                      <div className="flex items-center gap-2">
                        <div className="shrink-0 rounded-md bg-slate-900/70 p-2">
                          {isApertura ? <LogIn className="h-4 w-4 text-emerald-400" /> : <LogOut className="h-4 w-4 text-rose-400" />}
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {isApertura ? 'Apertura' : 'Cierre'} · {ev.shift}
                        </div>
                      </div>

                      <div className="flex min-w-0 items-center gap-2 text-sm text-slate-300">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{ev.by}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Clock className="h-4 w-4 text-slate-400" />
                        {hora}
                      </div>

                      <div className="text-right text-sm text-slate-300 md:text-left">
                        {ev.type === 'open' ? (
                          <>
                            Monto inicial:{' '}
                            <span className="font-semibold text-white">S/ {Number(('amount' in ev ? ev.amount : 0) ?? 0).toFixed(2)}</span>
                          </>
                        ) : (
                          <>
                            Ventas:{' '}
                            <span className="font-semibold text-white">S/ {Number(('sales' in ev ? ev.sales : 0) ?? 0).toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-2 pb-3">
                      <div className="grid gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3 md:grid-cols-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Turno</div>
                          <div className="text-sm font-semibold text-white">{ev.shift}</div>
                        </div>

                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Operador</div>
                          <div className="text-sm text-slate-200">{ev.by}</div>
                        </div>

                        <div className="md:text-right">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Fecha</div>
                          <div className="text-sm text-slate-200">
                            {dt.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {hora}
                          </div>
                        </div>

                        {ev?.notes && (
                          <div className="md:col-span-3">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">Notas</div>
                            <div className="break-words text-sm text-slate-200">{ev.notes}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {/* ----------------- FIN BLOQUE HISTORIAL ----------------- */}
      </section>

      {/* MODALES */}
      <CajaHistorialModal open={openHistModal} onClose={() => setOpenHistModal(false)} />
      <DetalleVentasModal
        open={openDetalle}
        onClose={() => setOpenDetalle(false)}
        shift={resumenShift}
        dayLabel={dayLabel}
        openingAmount={Number(cashControl.monto_inicial ?? 0)}
        cashOnHand={Number(cashControl.monto_fisico ?? 0)}
        rows={rowsNoCreditAgg.rows}
        totalGross={Number(rowsNoCreditAgg.totals.gross.toFixed(2))}
        totalGallons={Number(rowsNoCreditAgg.totals.gallons.toFixed(2))}
        creditRows={rowsCreditAgg.rows}
        creditTotalGross={Number(rowsCreditAgg.totals.gross.toFixed(2))}
        creditTotalGallons={Number(rowsCreditAgg.totals.gallons.toFixed(2))}
        methodDetails={(() => {
          const byMethod = new Map<string, Map<string, { gallons: number; gross: number }>>();
          for (const s of filteredRecentSales) {
            const label = String(s?._ui?.paymentLabel ?? '').trim() || '—';
            const product = String(s?._ui?.productName ?? '—') || '—';
            const gallons = Number(s?._ui?.gallons ?? 0) || 0;
            const gross =
              Number(s?._ui?.amountGross ?? s?._ui?.amountNet ?? s?.final_amount ?? s?.total_amount ?? 0) || 0;
            if (!byMethod.has(label)) byMethod.set(label, new Map());
            const rowsMap = byMethod.get(label)!;
            const agg = rowsMap.get(product) || { gallons: 0, gross: 0 };
            agg.gallons += gallons;
            agg.gross += gross;
            rowsMap.set(product, agg);
          }
          const catalogOrder =
            (pmCatalog?.map((m: any) => String(m?.method_name ?? m?.name ?? '').trim()).filter(Boolean)) || [];
          const labels = Array.from(byMethod.keys()).sort((a, b) => {
            const ia = catalogOrder.indexOf(a), ib = catalogOrder.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return a.localeCompare(b, 'es');
          });
          return labels.map((label) => {
            const rowsMap = byMethod.get(label)!;
            const rows = Array.from(rowsMap.entries()).map(([product, v]) => ({
              product,
              gallons: Number(v.gallons.toFixed(2)),
              gross: Number(v.gross.toFixed(2)),
            }));
            const totals = rows.reduce(
              (acc, r) => ({ gallons: acc.gallons + r.gallons, gross: acc.gross + r.gross }),
              { gallons: 0, gross: 0 }
            );
            return {
              label,
              rows,
              totalGallons: Number(totals.gallons.toFixed(2)),
              totalGross: Number(totals.gross.toFixed(2)),
            };
          });
        })()}
        creditClients={creditClientsForReport}
      />

      {/* Lecturas de medidores (scroll horizontal seguro en pantallas pequeñas) */}
      <div className="mt-4 w-full overflow-x-auto">
        <div className="min-w-max">
          <MeterReadingContent />
        </div>
      </div>
    </div>
  </div>
);

};

export default TurnosContent;
