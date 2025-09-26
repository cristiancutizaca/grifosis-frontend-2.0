'use client';

import { useEffect, useMemo, useState } from 'react';
import SettingsService from './../../../src/services/settingsService';

// Tipos locales genéricos (no fijos)
type ShiftWindow = { start: string; end: string };
type ShiftHoursDyn = Record<string, ShiftWindow>;
type AnyObj = Record<string, any>;

const normTime = (val: unknown): string | null => {
  if (typeof val !== 'string') return null;
  const s = val.trim();
  if (!s) return null;
  const [hStr, mStr] = s.split(':');
  const h = Number(hStr);
  const m = Number((mStr ?? '0').slice(0, 2));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const hh = Math.max(0, Math.min(23, Math.floor(h)));
  const mm = Math.max(0, Math.min(59, Math.floor(m)));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const normalizeSettingsToShifts = (cfg: AnyObj | null): { hours: ShiftHoursDyn; order: string[] } => {
  if (!cfg) return { hours: {}, order: [] };

  // acepta múltiples nombres/estructuras comunes
  const raw: unknown =
    (cfg as AnyObj).shift_hours ??
    (cfg as AnyObj).shiftHours ??
    (cfg as AnyObj).turnos ??
    (cfg as AnyObj).shifts ??
    (cfg as AnyObj)?.settings?.shift_hours ??
    {};

  const mapped: ShiftHoursDyn = {};

  const push = (nameRaw: unknown, startRaw: unknown, endRaw: unknown) => {
    const name = String(nameRaw ?? '').trim();
    const start = normTime(startRaw);
    const end = normTime(endRaw);
    if (!name || !start || !end) return;
    mapped[name] = { start, end };
  };

  if (Array.isArray(raw)) {
    // [{ name, start, end }, ...]
    for (const r of raw as AnyObj[]) push(r?.name, r?.start, r?.end);
  } else if (raw && typeof raw === 'object') {
    // { "<nombre>": "05:00-12:00" }  ó  { "<nombre>": { start, end } }
    for (const [k, v] of Object.entries(raw as AnyObj)) {
      if (!v) continue;
      if (typeof v === 'string' && v.includes('-')) {
        const [s, e] = v.split('-');
        push(k, s, e);
      } else if (typeof v === 'object') {
        push(k, (v as AnyObj).start, (v as AnyObj).end);
      }
    }
  }

  // posible orden provisto por el backend
  const orderRaw: unknown =
    (cfg as AnyObj).shift_order ??
    (cfg as AnyObj).shiftOrder ??
    (cfg as AnyObj).order ??
    (cfg as AnyObj)?.settings?.shift_order;

  const order = Array.isArray(orderRaw)
    ? (orderRaw as unknown[]).map((x) => String(x)).filter((n) => n in mapped)
    : Object.keys(mapped); // si no viene orden, usamos el de las keys

  return { hours: mapped, order };
};

/**
 * Hook: obtiene los turnos desde la BD.
 * - Sin defaults locales.
 * - Si el backend no trae nada, devuelve { hours: {}, order: [] }.
 */
export const useShiftHours = () => {
  const [hours, setHours] = useState<ShiftHoursDyn>({});
  const [order, setOrder] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const cfg = await SettingsService.getSettings().catch(() => null);
        if (ignore) return;
        const { hours: mapped, order: ord } = normalizeSettingsToShifts(cfg);
        setHours(mapped);
        setOrder(ord);
      } finally {
        if (!ignore) {
          setLoading(false);
          setLoaded(true);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Si en tu componente necesitas los tipos antiguos, puedes castear:
  // const { hours } = useShiftHours() as { hours: ShiftHours };
  return useMemo(() => ({ hours, order, loaded, loading }), [hours, order, loaded, loading]);
};
