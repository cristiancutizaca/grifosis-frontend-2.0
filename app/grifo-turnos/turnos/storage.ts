import type { ShiftName } from './shifts';

/* Normaliza el nombre del turno para claves locales (sin tildes, minúsculas) */
export const shiftSlug = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/* Sugerencias de apertura */
export const SUGGEST_PREFIX = 'open_suggest_v1';
export const suggestKey = (dayDate: string, shift: ShiftName) =>
  `${SUGGEST_PREFIX}:${dayDate}:${shiftSlug(String(shift))}`;
export const readSuggest = (dayDate: string, shift: ShiftName): number | null => {
  try {
    const raw = localStorage.getItem(suggestKey(dayDate, shift));
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
};
export const writeSuggest = (dayDate: string, shift: ShiftName, value: number | null) => {
  try {
    const k = suggestKey(dayDate, shift);
    if (value == null) localStorage.removeItem(k);
    else localStorage.setItem(k, String(value));
  } catch {}
};

/* Flags de apertura en UI */
export const OPEN_STATE_PREFIX = 'cash_box_open_v1';
export const openStateKey = (dayDate: string, shift: ShiftName) =>
  `${OPEN_STATE_PREFIX}:${dayDate}:${shiftSlug(String(shift))}`;
export const CURRENT_OPEN_FLAG = 'cash_box_open_current_v1';

/* Historial local (fallback) */
export const HISTORY_KEY = 'caja_history_v1';
export const loadHistory = <T = any>(): T[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return [] as any; }
};
export const saveHistory = (arr: any[]) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch {}
};
