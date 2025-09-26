export const PAYMENT_OPTIONS = [
  { id: 1, key: 'CASH',       label: 'Efectivo',      method_name: 'efectivo' },
  { id: 2, key: 'CREDIT',     label: 'Credito',       method_name: 'credito' },
  { id: 3, key: 'CARD',       label: 'Tarjeta',       method_name: 'tarjeta' },
  { id: 4, key: 'TRANSFER',   label: 'Transferencia', method_name: 'transferencia' },
] as const;

export type PaymentKey = typeof PAYMENT_OPTIONS[number]['key'];

export const IGV_BY_FUEL: Record<string, number> = {
  Diesel: 0.12,
  Regular: 0.16,
  Premium: 0.18,
};

export const getPaymentLabel = (s: any): string => {
  const pmStr = (s?.payment_method ?? '').toString().trim().toLowerCase();
  if (pmStr) {
    const opt = PAYMENT_OPTIONS.find(o => o.method_name.toLowerCase() === pmStr);
    return opt?.label ?? pmStr.charAt(0).toUpperCase() + pmStr.slice(1);
  }
  const id = Number(s?.payment_method_id);
  if (Number.isFinite(id)) {
    return PAYMENT_OPTIONS.find(o => o.id === id)?.label ?? '—';
  }
  return '—';
};

/* =========================================================
   🔽 CÓDIGO NUEVO (DINÁMICO). NO MODIFICA NADA TUYO 🔽
   ---------------------------------------------------------
   Objetivo: reflejar métodos ACTIVOS de Configuración
   (incluye nuevos) en Turnos: rótulos, desglose y total.
   ========================================================= */

type RuntimeMethod = {
  id?: number;
  key: string;         // p.ej. 'CASH', 'CARD', 'TRANSFER', 'CREDIT', 'YAPE_PLIN', etc.
  label: string;       // texto a mostrar
  method_name: string; // nombre "técnico" que suele venir en ventas: 'efectivo', 'tarjeta', 'credito', ...
  order?: number;
};

const norm = (s?: string) =>
  (s ?? '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, ''); // sin acentos

/** Convierte el método remoto a nuestro formato RuntimeMethod */
export function toRuntime(m: any): RuntimeMethod {
  // campos que pueden venir desde settings/payment-methods: code, key, method_name, label, id, order
  const methodName =
    m?.method_name
      ? norm(m.method_name)
      : m?.code
      ? norm(m.code)
      : m?.label
      ? norm(m.label)
      : '';
  const keyBase = (m?.key ?? m?.code ?? methodName).toString().trim().toUpperCase();
  return {
    id: Number.isFinite(Number(m?.id)) ? Number(m?.id) : undefined,
    key: keyBase || 'UNKNOWN',
    label: m?.label ?? m?.name ?? (methodName ? (methodName.charAt(0).toUpperCase() + methodName.slice(1)) : '—'),
    method_name: methodName || 'unknown',
    order: Number.isFinite(Number(m?.order)) ? Number(m?.order) : undefined,
  };
}

/** Catálogo estático (tuyo) como RuntimeMethod[] */
export const STATIC_CATALOG: RuntimeMethod[] = Array.from(PAYMENT_OPTIONS, o => ({
  id: o.id,
  key: o.key,
  label: o.label,
  method_name: o.method_name.toLowerCase(),
}));

/**
 * Fusiona el catálogo remoto (configuración) con tu catálogo estático,
 * sin duplicados (compara por method_name o id). Remotos mandan en label/order.
 */
export function mergeCatalog(remoteList: any[]): RuntimeMethod[] {
  const remote = (remoteList ?? []).map(toRuntime);
  const mapByName = new Map<string, RuntimeMethod>();
  const mapById = new Map<number, RuntimeMethod>();

  // Primero remoto
  for (const m of remote) {
    if (m.method_name) mapByName.set(m.method_name, m);
    if (m.id != null) mapById.set(m.id, m);
  }
  // Luego estático si no existía
  for (const s of STATIC_CATALOG) {
    const existsByName = s.method_name && mapByName.has(s.method_name);
    const existsById = s.id != null && mapById.has(s.id!);
    if (!existsByName && !existsById) {
      mapByName.set(s.method_name, s);
    }
  }

  const merged = Array.from(mapByName.values());
  // Ordena por 'order' si viene; si no, por label
  merged.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.label.localeCompare(b.label));
  return merged;
}

/** Busca el label correcto usando un catálogo dinámico (merged). */
export function getPaymentLabelDynamic(saleOrCode: any, catalog: RuntimeMethod[]): string {
  // Si llega un string directo (código/method_name)
  if (typeof saleOrCode === 'string') {
    const code = norm(saleOrCode);
    const hit = catalog.find(c => c.method_name === code || c.key.toLowerCase() === code);
    return hit?.label ?? (saleOrCode ? saleOrCode : '—');
  }

  // Si llega una venta
  const pmStr = norm(saleOrCode?.payment_method);
  if (pmStr) {
    const byName = catalog.find(c => c.method_name === pmStr);
    if (byName) return byName.label;
  }
  const id = Number(saleOrCode?.payment_method_id);
  if (Number.isFinite(id)) {
    const byId = catalog.find(c => c.id === id);
    if (byId) return byId.label;
  }

  // Detección de crédito por flags
  if (
    saleOrCode?.is_credit === true ||
    saleOrCode?.credit === true ||
    saleOrCode?.credit_id || saleOrCode?.creditId ||
    saleOrCode?.payment_type === 'credit'
  ) {
    const credit = catalog.find(c => c.method_name === 'credito' || c.key === 'CREDIT');
    return credit?.label ?? 'Credito';
  }

  // Notes como JSON
  const notes = saleOrCode?.notes;
  if (typeof notes === 'string' && notes.trim().startsWith('{')) {
    try {
      const n = JSON.parse(notes);
      for (const f of [n?.payment_method, n?.method, n?.pm, n?.type]) {
        const k = norm(f);
        const by = catalog.find(c => c.method_name === k || c.key.toLowerCase() === k);
        if (by) return by.label;
      }
      if (n?.credit === true) {
        const credit = catalog.find(c => c.method_name === 'credito' || c.key === 'CREDIT');
        return credit?.label ?? 'Credito';
      }
    } catch {}
  }

  return '—';
}

/** Devuelve la KEY (dinámica) para una venta, usando el catálogo. */
export function resolvePaymentKeyDynamic(sale: any, catalog: RuntimeMethod[]): string {
  if (
    sale?.is_credit === true ||
    sale?.credit === true ||
    sale?.credit_id || sale?.creditId ||
    sale?.payment_type === 'credit'
  ) return (catalog.find(c => c.method_name === 'credito' || c.key === 'CREDIT')?.key ?? 'CREDIT');

  const tryMatch = (val?: string) => {
    const k = norm(val);
    if (!k) return '';
    const by = catalog.find(c => c.method_name === k || c.key.toLowerCase() === k);
    return by?.key ?? '';
  };

  const fields = [
    sale?.payment_method,
    sale?.paymentMethod,
    sale?.method,
    sale?.payment?.method,
    sale?.payment_mode,
    sale?.pay_mode,
  ];
  for (const f of fields) {
    const hit = tryMatch(f);
    if (hit) return hit;
  }

  const notes = sale?.notes;
  if (typeof notes === 'string' && notes.trim().startsWith('{')) {
    try {
      const n = JSON.parse(notes);
      for (const f of [n?.payment_method, n?.method, n?.pm, n?.type]) {
        const hit = tryMatch(f);
        if (hit) return hit;
      }
      if (n?.credit === true) {
        return (catalog.find(c => c.method_name === 'credito' || c.key === 'CREDIT')?.key ?? 'CREDIT');
      }
    } catch {}
  }

  const id = Number(sale?.payment_method_id);
  if (Number.isFinite(id)) {
    const byId = catalog.find(c => c.id === id);
    if (byId) return byId.key;
  }

  return 'UNKNOWN';
}

/** Suma por método (solo los activos del catálogo) */
export function sumByPaymentDynamic(
  sales: any[],
  getAmount: (s: any) => number,
  catalog: RuntimeMethod[]
): Record<string, number> {
  const acc: Record<string, number> = {};
  // preinicializa todos activos con 0 para pintar en UI aunque no tengan ventas
  for (const m of catalog) acc[m.key] = 0;
  for (const s of sales) {
    const key = resolvePaymentKeyDynamic(s, catalog);
    if (key in acc) acc[key] += Number(getAmount(s) ?? 0);
  }
  return acc;
}

/** ¿Entra a caja? Regla: todo salvo 'CREDIT' y 'UNKNOWN'. */
export function isCashBoxKey(key: string) {
  return key !== 'CREDIT' && key !== 'UNKNOWN';
}

/** Total en caja = apertura + suma de métodos que sí entran a caja. */
export function computeCashBoxTotalDynamic(
  openingAmount: number,
  breakdownByKey: Record<string, number>
) {
  const mov = Object.entries(breakdownByKey)
    .filter(([k]) => isCashBoxKey(k))
    .reduce((sum, [, v]) => sum + Number(v ?? 0), 0);
  return Number(openingAmount ?? 0) + mov;
}
