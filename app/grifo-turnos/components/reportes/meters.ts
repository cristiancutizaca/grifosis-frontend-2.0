// NO pongas 'use client' aquí

import cashBoxService from '../../../../src/services/cashBoxService';
import NozzleService from '../../../../src/services/nozzleService';
import PumpService from '../../../../src/services/pumpService';
import ProductService from '../../../../src/services/productService';

/* ========================= Tipos públicos ========================= */
export type MeterRow = {
  product: string;
  nozzle: string | number;
  open?: number;
  close?: number;
  diff?: number;
  unitPrice?: number;
  total?: number;
};

export type MetersResult = {
  ok: boolean;
  tOpen?: number;
  tClose?: number;
  tPrevClose?: number;
  ymd: string;
  byPump: Record<string, MeterRow[]>;
  grand: { gallons: number; total: number };
};

/* ========================= Utils internas ========================= */
const tsNum = (raw?: any) => {
  const v =
    raw?.timestamp ??
    raw?.created_at ??
    raw?.createdAt ??
    raw?.updated_at ??
    raw?.closed_at ??
    raw?.opened_at ??
    raw?.date ??
    raw?.fecha ??
    '';
  const s = String(v);
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : -Infinity;
};

const toYmd = (d: Date) =>
  d.toLocaleString('sv-SE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).slice(0, 10);

const addDaysYmd = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00-05:00`);
  d.setDate(d.getDate() + n);
  return toYmd(d);
};

const getProdUnitPrice = (prod: any): number => {
  const cands = [
    prod?.price_per_gallon,
    prod?.unit_price,
    prod?.price,
    prod?.precio,
    prod?.pvp,
    prod?.current_price,
    prod?.sale_price,
  ];
  const n = cands.map(Number).find((v) => Number.isFinite(v) && v >= 0);
  return Number(n ?? 0);
};

/* ========================= Detectores de eventos de caja ========================= */
const isOpenEvt = (e: any) => {
  const type = String(e?.type ?? e?.evento ?? e?.action ?? e?.status ?? '').toLowerCase();
  return /(open|apert|abr|apertura de caja|caja abierta)/i.test(type);
};
const isCloseEvt = (e: any) => {
  const type = String(e?.type ?? e?.evento ?? e?.action ?? e?.status ?? '').toLowerCase();
  return /(close|cierre|cerr|cash_close|caja cerrada)/i.test(type);
};

/**
 * Encuentra la ventana de la **sesión actual** (independiente de turnos):
 * - tClose = último evento de cierre del período (día-1, día, día+1).
 * - tOpen  = última apertura <= tClose.
 * - tPrevClose = cierre anterior a esa apertura (congela la apertura de medidores).
 * Si no hay cierre (caja abierta) y fallbackNowIfOpen = '1', usa "now" como tClose.
 */
export const findSessionWindow = async (
  dayYmd: string,
  fallbackNowIfOpen: '0' | '1' = '1'
): Promise<{ ok: boolean; tOpen?: number; tClose?: number; tPrevClose?: number; usedDay: string }> => {
  const loadEvents = async (ymd: string) => {
    try {
      return (await cashBoxService.historyDay(ymd))?.events ?? [];
    } catch {
      return [];
    }
  };

  const [evPrev, evToday, evNext] = await Promise.all([
    loadEvents(addDaysYmd(dayYmd, -1)),
    loadEvents(dayYmd),
    loadEvents(addDaysYmd(dayYmd, 1)),
  ]);

  const opens = [...evPrev, ...evToday, ...evNext]
    .filter(isOpenEvt)
    .sort((a, b) => tsNum(a) - tsNum(b));

  const closes = [...evPrev, ...evToday, ...evNext]
    .filter(isCloseEvt)
    .sort((a, b) => tsNum(a) - tsNum(b));

  let tClose: number | undefined;

  if (closes.length > 0) {
    const lastCloseEvt = closes.at(-1);
    tClose = tsNum(lastCloseEvt || {});
  } else if (fallbackNowIfOpen === '1' && opens.length > 0) {
    // Caja abierta: sin cierre aún → usamos "ahora" para previsualizar
    tClose = Date.now();
  } else {
    return { ok: false, usedDay: dayYmd };
  }

  if (!Number.isFinite(tClose)) return { ok: false, usedDay: dayYmd };

  const openPrevEvt = opens.filter((o) => tsNum(o) <= (tClose as number)).pop();
  const tOpen = tsNum(openPrevEvt || {});
  if (!(Number.isFinite(tOpen) && (tOpen as number) <= (tClose as number))) {
    return { ok: false, usedDay: dayYmd };
  }

  const prevCloseEvt = closes.filter((c) => tsNum(c) < (tOpen as number)).pop();
  const tPrevClose = tsNum(prevCloseEvt || {});

  return {
    ok: true,
    tOpen,
    tClose,
    tPrevClose: Number.isFinite(tPrevClose) ? tPrevClose : undefined,
    usedDay: dayYmd,
  };
};

/* ============================================================
   Medidores → MetersResult (sin turnos)
   ============================================================ */
export const buildMetersData = async (
  dayYmd: string,
  _shiftRef_ignored?: { id?: string; name?: string },   // se ignora para independencia de turnos
  opts?: { fallbackNowIfOpen?: '0' | '1' }               // opcional: usar "now" si caja abierta
): Promise<MetersResult> => {
  const fallbackNow = opts?.fallbackNowIfOpen ?? '1';

  // 1) Ventana de sesión por eventos de caja (independiente de turnos)
  const sess = await findSessionWindow(dayYmd, fallbackNow);
  if (!sess.ok) {
    return {
      ok: false,
      tOpen: undefined,
      tClose: undefined,
      tPrevClose: undefined,
      ymd: dayYmd,
      byPump: {},
      grand: { gallons: 0, total: 0 },
    };
  }

  // 2) Lecturas (traemos día y día-1 para cubrir borde de apertura)
  const prevYmd = addDaysYmd(dayYmd, -1);
  const [nozzles, pumps, products, todayReads, prevReads] = await Promise.all([
    NozzleService.getAllNozzles(),
    PumpService.getAllPumps(),
    ProductService.getAllProducts(),
    cashBoxService.dayReadings(dayYmd),   // ⬅️ antes: MeterReadingService.getShiftReadings(dayYmd)
    cashBoxService.dayReadings(prevYmd)
  ]);

  const pumpById = new Map((pumps || []).map((p: any) => [p.pump_id, p]));
  const prodById = new Map((products || []).map((p: any) => [p?.product_id ?? p?.id ?? p?.productId, p]));

  // 3) Agrupar por boquilla
  const byNozzle: Record<number, any[]> = {};
  const pushRead = (r: any) => {
    const id = Number(r?.nozzle_id ?? r?.nozzleId);
    if (!Number.isFinite(id)) return;
    (byNozzle[id] ||= []);

    if (Number.isFinite(tsNum(r))) byNozzle[id].push(r);

    const arr = Array.isArray(r?.readings)
      ? r.readings
      : Array.isArray(r?.timeline)
      ? r.timeline
      : Array.isArray(r?.entries)
      ? r.entries
      : [];
    const extras = [r?.firstReading, r?.lastReading].filter(Boolean);
    for (const it of [...arr, ...extras]) if (Number.isFinite(tsNum(it))) byNozzle[id].push(it);
  };
  (todayReads || []).forEach(pushRead);
  (prevReads || []).forEach(pushRead);

  const { tOpen, tClose, tPrevClose } = sess;
  const tOpenMs = tOpen as number;
  const tCloseMs = tClose as number;

  // 4) Helpers
  const finalOf = (o: any) => {
    const n = Number(o?.final_reading ?? o?.final ?? o?.end ?? o?.cierre);
    return Number.isFinite(n) ? n : undefined;
  };
  const initialOf = (o: any) => {
    const n = Number(o?.initial_reading ?? o?.initial ?? o?.start ?? o?.apertura);
    return Number.isFinite(n) ? n : undefined;
  };

  /**
   * Apertura = último final_reading <= tOpenFrozen
   * (fallback: initial_reading del primer registro >= tOpenFrozen)
   * Cierre   = último final_reading <= tCierre
   */
  const pickUsingFrozenPrevClose = (
    timeline: any[],
    tApertura: number,
    tCierre: number,
    tCierrePrev?: number
  ) => {
    const arr = (timeline || [])
      .filter((it) => Number.isFinite(tsNum(it)))
      .sort((a, b) => tsNum(a) - tsNum(b));

    const tOpenFrozen = Number.isFinite(tCierrePrev as number) ? (tCierrePrev as number) : tApertura;

    const lastBeforeOrAtOpen = arr.filter((it) => tsNum(it) <= tOpenFrozen).pop() || null;
    let opening = finalOf(lastBeforeOrAtOpen);

    if (!Number.isFinite(opening as number)) {
      const firstAtOrAfterOpen = arr.find((it) => tsNum(it) >= tOpenFrozen) || null;
      opening = initialOf(firstAtOrAfterOpen);
    }

    const lastAtClose = arr.filter((it) => tsNum(it) <= tCierre).pop() || null;
    const closing = finalOf(lastAtClose);

    return { opening, closing };
  };

  // 5) Construcción por surtidor
  const byPump: Record<string, MeterRow[]> = {};
  let grandGallons = 0, grandTotal = 0;

  for (const noz of (nozzles || [])) {
    const nozzleId = Number(noz.nozzle_id);
    const pump = pumpById.get(noz.pump_id);
    const prod = prodById.get(noz.product_id);
    const pumpName = pump?.pump_name ?? 'Surtidor —';

    const timeline = (byNozzle[nozzleId] || [])
      .filter((x) => tsNum(x) <= tCloseMs)
      .sort((a, b) => tsNum(a) - tsNum(b));

    const { opening, closing } = pickUsingFrozenPrevClose(
      timeline,
      tOpenMs,
      tCloseMs,
      tPrevClose
    );

    let diff: number | undefined;
    if (
      Number.isFinite(opening as number) &&
      Number.isFinite(closing as number) &&
      (closing as number) >= (opening as number)
    ) {
      diff = Number(((closing as number) - (opening as number)).toFixed(3));
    }

    const unit = getProdUnitPrice(prod || {});
    const total = Number.isFinite(diff as number) ? Number(((diff as number) * unit).toFixed(2)) : 0;

    const row: MeterRow = {
      product: prod?.product_name ?? prod?.name ?? prod?.product ?? prod?.description ?? '—',
      nozzle: noz?.nozzle_number ?? '—',
      open: Number.isFinite(opening as number) ? (opening as number) : undefined,
      close: Number.isFinite(closing as number) ? (closing as number) : undefined,
      diff: Number.isFinite(diff as number) ? (diff as number) : undefined,
      unitPrice: unit,
      total,
    };

    (byPump[pumpName] ||= []).push(row);
    if (Number.isFinite(row.diff)) grandGallons += row.diff!;
    grandTotal += row.total || 0;
  }

  return {
    ok: true,
    tOpen,
    tClose,
    tPrevClose,
    ymd: dayYmd,
    byPump,
    grand: { gallons: Number(grandGallons.toFixed(3)), total: Number(grandTotal.toFixed(2)) },
  };
};
