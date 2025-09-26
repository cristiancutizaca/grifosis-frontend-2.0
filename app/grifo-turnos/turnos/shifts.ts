// shifts.ts — dinámico desde BD + null-safe

/** Nombres de turno vienen 100% de la BD */
export type ShiftName = string;

export type ShiftWindow = { start: string; end: string };

/** Mapa de nombre → horario (también viene de la BD) */
export type ShiftHours = Record<ShiftName, ShiftWindow>;

/** Fallback para UI si aún no hay turno resuelto */
const FALLBACK_SHIFT: ShiftName = '—';

/* ====== Utils de tiempo ====== */
export const toMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
};

export const inRange = (t: number, s: number, e: number) =>
  s <= e ? t >= s && t < e : t >= s || t < e;

export const toYMD = (d: Date) => d.toISOString().slice(0, 10);

export const toLocalYMD = (d: Date) => {
  const y = d.getFullYear(), m = d.getMonth() + 1, da = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
};

/* ====== Nombres / orden ====== */

/** Passthrough si la API usa el mismo nombre */
export const shiftForApi = (s: ShiftName): string => s;

/** Normaliza mínimamente para UI */
export const normShiftForUi = (s?: string): ShiftName => (s ?? FALLBACK_SHIFT).trim() || FALLBACK_SHIFT;

/**
 * Siguiente turno según `order` (proporcionado por la BD).
 * Si `current` no está en el arreglo, devuelve el primero.
 */
export const nextShift = (current: ShiftName, order: ShiftName[]): ShiftName => {
  const arr = Array.isArray(order) ? order : [];
  if (!arr.length) return current ?? FALLBACK_SHIFT;
  const i = arr.indexOf(current);
  return arr[(i >= 0 ? i + 1 : 0) % arr.length];
};

/* ====== Resolución por hora actual ====== */

/**
 * Devuelve el nombre del turno activo basado en `hours`.
 * Si `hours` es null/undefined o vacío, retorna FALLBACK_SHIFT.
 */
export const resolveShiftName = (hours: ShiftHours | null | undefined, when: Date): ShiftName => {
  const t = when.getHours() * 60 + when.getMinutes();

  const entries = Object.entries(hours ?? {});
  for (const [name, w] of entries) {
    if (inRange(t, toMinutes(w.start), toMinutes(w.end))) return name as ShiftName;
  }

  return (entries[0]?.[0] as ShiftName) ?? FALLBACK_SHIFT;
};

/**
 * Rango [from, to) para un turno. Soporta turnos que cruzan medianoche.
 * Si `hours` o `name` no existen, devuelve rango de todo el día como fallback.
 */
export const getShiftRange = (
  hours: ShiftHours | null | undefined,
  name: ShiftName,
  now: Date
) => {
  const w = (hours ?? {})[name];

  // Fallback: día completo si no hay datos aún
  if (!w) {
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    const to = new Date(now);   to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  const s = toMinutes(w.start), e = toMinutes(w.end);
  const t = now.getHours() * 60 + now.getMinutes();

  const from = new Date(now), to = new Date(now);
  from.setHours(Math.floor(s / 60), s % 60, 0, 0);
  to.setHours(Math.floor(e / 60), e % 60, 0, 0);

  // cruza medianoche
  if (s > e && t < e) from.setDate(from.getDate() - 1);
  if (s > e && t >= s) to.setDate(to.getDate() + 1);

  return { from, to };
};
