import ApiService from "./apiService";

/* ===================== Tipos base ===================== */
export type ShiftKey = 'Leon' | 'Lobo' | 'Buho';

export interface CashBoxTodayParams {
  date: string;   // YYYY-MM-DD (día operativo)
  shift: ShiftKey;
}

export interface CashBoxSession {
  id: number;
  status: 'abierta' | 'cerrada' | string;
  day_date?: string;           // YYYY-MM-DD
  shift_name?: string;         // Leon/Tarde/Buho
  opening_amount?: number | null;
  closing_amount?: number | null; // total en caja al cerrar
  sales_amount?: number | null;   // ventas del turno
  opened_by?: number | null;
  opened_by_name?: string | null;
  closed_by?: number | null;
  closed_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
  // algunos backends devuelven también:
  opened_at?: string | null;
  closed_at?: string | null;
  is_closed?: boolean | null;
}

/* Filas “crudas” esperadas desde /sessions o /list */
export interface CashBoxSessionRow extends Required<Pick<CashBoxSession,
  'id' | 'day_date' | 'shift_name'
>> {
  opening_amount: number | null;
  closing_amount: number | null;
  sales_amount: number | null;
  opened_by: number | null;
  opened_by_name: string | null;
  closed_by: number | null;
  closed_by_name: string | null;
  opened_at: string | null;
  closed_at: string | null;
  is_closed: boolean | null;
  notes?: string | null;
}

/* Estructura de historial para la UI (modal) */
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

/* ========= NUEVO: tipo para lecturas de medidores ========= */
export type MeterReadingRow = {
  pump_id?: number;
  pump_name?: string;
  nozzle_id?: number;
  nozzle_number?: number | string;
  product_id?: number;
  product_name?: string;
  unit?: string; // 'gal', 'L', etc.

  // nombres que puede usar el backend
  reading_open?: number | string;
  reading_close?: number | string;
  opening_reading?: number | string;
  closing_reading?: number | string;
};

/* ============== Utilidades internas del servicio ============== */
const ymd = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString().slice(0, 10);

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Pequeña normalización por si llegan “León”/“Búho” con acento o “lobo”
const normalizeShift = (s: any): ShiftKey => {
  const clean = String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
  if (clean.startsWith('leo')) return 'Leon';
  if (clean.startsWith('tar') || clean.startsWith('lob')) return 'Lobo';
  return 'Buho';
};

function toHistoryDays(rows: CashBoxSessionRow[]): CajaHistoryDay[] {
  const map: Record<string, CajaEvent[]> = {};

  for (const r of rows) {
    const dateKey = r.day_date;
    if (!map[dateKey]) map[dateKey] = [];

    // Apertura
    if (r.opened_at) {
      map[dateKey].push({
        type: 'open',
        by: r.opened_by_name ?? '—',
        amount: r.opening_amount == null ? undefined : Number(r.opening_amount),
        timestamp: r.opened_at,
        shift: r.shift_name,
        notes: r.notes ?? undefined,
      });
    }

    // Cierre (cuando hay closed_at o is_closed)
    if ((r.is_closed || r.closed_at) && r.closed_at) {
      map[dateKey].push({
        type: 'close',
        by: r.closed_by_name ?? '—',
        sales: r.sales_amount == null ? undefined : Number(r.sales_amount),
        totalInCash: r.closing_amount == null ? undefined : Number(r.closing_amount),
        timestamp: r.closed_at,
        shift: r.shift_name,
        notes: r.notes ?? undefined,
      });
    }
  }

  const days: CajaHistoryDay[] = Object.entries(map).map(([dateKey, events]) => ({
    dateKey,
    events: events.sort(
      (a, b) => new Date(b.timestamp as any).getTime() - new Date(a.timestamp as any).getTime()
    ),
  }));
  days.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
  return days;
}

/* ====================== Servicio ====================== */
class CashBoxService {
  private basePoint = "/cash-box";

  // QS ignorando undefined/null/""
  private qs(o?: Record<string, any>) {
    const p = new URLSearchParams();
    Object.entries(o || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
    });
    return p.toString();
  }

  /* ====== EXISTENTES ====== */

  // GET /api/cash-box/today?date=YYYY-MM-DD&shift=Leon  -> una sesión
  async getToday(params: CashBoxTodayParams): Promise<CashBoxSession> {
    // ✅ usar 'shift' (canónico) y normalizado
    const q = this.qs({ date: params.date, shift: normalizeShift(params.shift) });
    const url = `${this.basePoint}/today?${q}`;
    return await ApiService.get<CashBoxSession>(url);
  }

  // GET /api/cash-box/today  -> lista de sesiones del día (modo historial)
  async todayList(): Promise<any[]> {
    const url = `${this.basePoint}/today`;
    const res: any = await ApiService.get<any>(url);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.rows)) return res.rows;
    return [];
  }

  // GET /api/cash-box/list?from=YYYY-MM-DD&to=YYYY-MM-DD -> historial por rango
  async list(params?: { from?: string; to?: string }): Promise<any[]> {
    const q = this.qs(params || {});
    const url = `${this.basePoint}/list${q ? `?${q}` : ""}`;
    const res: any = await ApiService.get<any>(url);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.rows)) return res.rows;
    return [];
  }

  // POST /api/cash-box/open
  async open(body: {
    day_date: string;
    shift_name: ShiftKey;
    opening_amount: number;
    opened_by?: number;
    opened_by_name?: string;
  }): Promise<CashBoxSession> {
    // Normaliza por si llega con acento
    const payload = { ...body, shift_name: normalizeShift(body.shift_name) };
    return await ApiService.post<CashBoxSession>(`${this.basePoint}/open`, payload);
  }

  // POST /api/cash-box/close
  async close(body: {
    id: number;
    closing_amount: number;
    sales_amount?: number;     // opcional
    notes?: string;
    closed_by?: number;
    closed_by_name?: string;
  }): Promise<{ ok?: boolean } & Partial<CashBoxSession>> {
    return await ApiService.post<{ ok?: boolean } & Partial<CashBoxSession>>(
      `${this.basePoint}/close`,
      body
    );
  }

  /* ====== NUEVO: Endpoints de historial ====== */
  async sessions(params: { start: string; end: string; shift?: ShiftKey }): Promise<CashBoxSessionRow[]> {
    const { start, end } = params;
    // /list ya devuelve el rango; ignoramos shift si tu /list no lo soporta
    const rows: any[] = await this.list({ from: start, to: end });
    return Array.isArray(rows) ? rows as CashBoxSessionRow[] : [];
  }

  /** Alias de compatibilidad (código viejo puede llamarlo). */
  async getSessions(params: { start: string; end: string; shift?: ShiftKey }): Promise<CashBoxSessionRow[]> {
    return this.sessions(params);
  }

  // GET /api/cash-box/history?day=YYYY-MM-DD  -> historial de un día ya mapeado
  async historyDay(date: string): Promise<CajaHistoryDay> {
    // ✅ usar 'day' (tu backend lo espera así)
    const url = `${this.basePoint}/history?day=${encodeURIComponent(date)}`;
    const res: any = await ApiService.get<any>(url);
    // Normalizaciones frecuentes
    if (res?.dateKey && Array.isArray(res?.events)) return res as CajaHistoryDay;
    if (res?.data?.dateKey && Array.isArray(res?.data?.events)) return res.data as CajaHistoryDay;
    if (Array.isArray(res?.events) && typeof res?.date === 'string') {
      return { dateKey: res.date, events: res.events as CajaEvent[] };
    }
    // Fallback por si retorna un arreglo de eventos "suelto"
    if (Array.isArray(res)) return { dateKey: date, events: res as CajaEvent[] };
    return { dateKey: date, events: [] };
  }

  /** Alias de compatibilidad (el modal puede llamar getHistory). */
  async getHistory(date: string): Promise<CajaHistoryDay> {
    return this.getHistoryDayOrMap(date);
  }

  /* ====== NUEVO: Helpers de alto nivel para el modal ====== */

  /**
   * Trae historial por rango, intentando en orden:
   * 1) /sessions (rango)
   * 2) /list (rango)
   * 3) /history?day=... (día por día, fallback)
   */
  async getHistoryRange(params: { from: string; to: string; shift?: ShiftKey; maxDaysFallback?: number }): Promise<CajaHistoryDay[]> {
    const { from, to, shift, maxDaysFallback = 14 } = params;

    // 1) Intento con /sessions
    try {
      const rows = await this.sessions({ start: from, end: to, shift });
      return toHistoryDays(rows);
    } catch (_) { /* sigue */ }

    // 2) Intento con /list
    try {
      const rows: CashBoxSessionRow[] = await this.list({ from, to }) as any[];
      return toHistoryDays(rows);
    } catch (_) { /* sigue */ }

    // 3) Fallback día por día con /history
    const startDate = new Date(from + 'T00:00:00');
    const endDate = new Date(to + 'T00:00:00');

    const out: CajaHistoryDay[] = [];
    let cursor = new Date(endDate);

    for (let i = 0; i < maxDaysFallback && cursor >= startDate; i++) {
      const key = ymd(cursor);
      try {
        const day = await this.historyDay(key);
        out.push(day);
      } catch {
        // si falla ese día, lo omitimos
      }
      cursor = addDays(cursor, -1);
    }

    out.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
    return out;
  }

  /**
   * Historial de un solo día.
   * Primero intenta /history?day=..., si no existe usa /sessions o /list
   * para el mismo día y mapea a {dateKey, events[]}.
   */
  async getHistoryDayOrMap(date: string, shift?: ShiftKey): Promise<CajaHistoryDay> {
    // 1) /history directo
    try {
      return await this.historyDay(date);
    } catch (_) { /* sigue */ }

    // 2) /sessions de un solo día
    try {
      const rows = await this.sessions({ start: date, end: date, shift });
      const days = toHistoryDays(rows);
      return days[0] ?? { dateKey: date, events: [] };
    } catch (_) { /* sigue */ }

    // 3) /list de un solo día
    const rows: CashBoxSessionRow[] = await this.list({ from: date, to: date }) as any[];
    const days = toHistoryDays(rows);
    return days[0] ?? { dateKey: date, events: [] };
  }

  /* ========= NUEVO: lecturas de medidores por turno ========= */
  // GET /api/cash-box/meters?date=YYYY-MM-DD&shift=Leon
  async getShiftMeters(params: { date: string; shift: ShiftKey }): Promise<MeterReadingRow[]> {
    const q = this.qs({ date: params.date, shift: normalizeShift(params.shift) });

    // Probar rutas más comunes sin romper tu backend actual
    const tryUrls = [
      `${this.basePoint}/meters?${q}`,
      `${this.basePoint}/readings?${q}`,
      `/meters?${q}`,
    ];

    for (const url of tryUrls) {
      try {
        const res: any = await ApiService.get<any>(url);
        if (Array.isArray(res)) return res as MeterReadingRow[];
        if (Array.isArray(res?.data)) return res.data as MeterReadingRow[];
        if (Array.isArray(res?.rows)) return res.rows as MeterReadingRow[];
      } catch {
        // Si falla, probamos la siguiente
      }
    }
    return [];
  }
}

export default new CashBoxService();
