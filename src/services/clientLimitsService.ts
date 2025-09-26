// src/services/clientLimitsService.ts
'use client';

import api from './apiService';

export type PeriodKind = 'day' | 'week' | 'month' | 'rolling_30d';

export interface ClientLimitRow {
  id: number;
  clientId: number;
  productId: number;
  productName?: string;
  periodKind: PeriodKind;
  maxGallons: number | null;
  applyToAllPayments: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UsageResponse {
  clientId: number;
  productId: number;
  periodKind: PeriodKind;
  maxGallons: number | null;
  usedGallons: number;
  remainingGallons: number | null;
  applyToAllPayments: boolean | null;
}

/* -------------------- helpers -------------------- */

function normalizeArray<T = any>(resp: any): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (Array.isArray(resp?.rows)) return resp.rows as T[];
  if (Array.isArray(resp?.data)) return resp.data as T[];
  if (Array.isArray(resp?.items)) return resp.items as T[];
  return [];
}

function toCamel(row: any): ClientLimitRow {
  if (!row) {
    return row;
  }
  return {
    id: Number(row.id ?? row.limit_id ?? 0),
    clientId: Number(row.client_id ?? row.clientId),
    productId: Number(row.product_id ?? row.productId),
    productName: row.product_name ?? row.productName,
    periodKind: (row.period_kind ?? row.periodKind) as PeriodKind,
    maxGallons:
      row.max_gallons !== undefined && row.max_gallons !== null
        ? Number(row.max_gallons)
        : row.maxGallons !== undefined && row.maxGallons !== null
        ? Number(row.maxGallons)
        : null,
    applyToAllPayments: Boolean(
      row.apply_to_all_payments ?? row.applyToAllPayments ?? true
    ),
    isActive: Boolean(row.is_active ?? row.isActive ?? true),
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

function toSnake(payload: Partial<ClientLimitRow>) {
  return {
    period_kind: payload.periodKind,
    max_gallons:
      payload.maxGallons === null || payload.maxGallons === undefined
        ? null
        : Number(payload.maxGallons),
    apply_to_all_payments:
      payload.applyToAllPayments === undefined
        ? true
        : Boolean(payload.applyToAllPayments),
    is_active:
      payload.isActive === undefined ? true : Boolean(payload.isActive),
  };
}

/* -------------------- API -------------------- */

/** Listar límites de un cliente (siempre retorna array de camelCase) */
export async function listClientLimits(
  clientId: number,
  opts?: { period?: PeriodKind; active?: boolean }
): Promise<ClientLimitRow[]> {
  const qs = new URLSearchParams();
  if (opts?.period) qs.set('period', opts.period);
  if (typeof opts?.active === 'boolean') qs.set('active', String(opts.active));
  const url = `/clients/${clientId}/limits/products${
    qs.toString() ? `?${qs}` : ''
  }`;

  const resp = await api.get<any>(url);
  return normalizeArray<any>(resp).map(toCamel);
}

/** Crear/actualizar límite para un producto */
export async function upsertClientLimit(
  clientId: number,
  productId: number,
  body: {
    periodKind: PeriodKind;
    maxGallons: number;
    applyToAllPayments?: boolean;
    isActive?: boolean;
  }
): Promise<ClientLimitRow> {
  const payload = toSnake(body);
  const resp = await api.put<any>(
    `/clients/${clientId}/limits/products/${productId}`,
    payload
  );
  return toCamel(resp);
}

/** Activar/desactivar límite; si pasas period, afecta solo ese período */
export async function setClientLimitActive(
  clientId: number,
  productId: number,
  isActive: boolean,
  period?: PeriodKind
): Promise<{ updated: number } | any> {
  const qs = period ? `?period=${period}` : '';
  // el backend acepta body plano { isActive } o { is_active }
  const resp = await api.patch<any>(
    `/clients/${clientId}/limits/products/${productId}/active${qs}`,
    { isActive }
  );
  return resp;
}

/** Eliminar/desactivar un límite específico (por período) */
export async function deleteClientLimit(
  clientId: number,
  productId: number,
  period: PeriodKind
): Promise<{ deactivated: boolean } | any> {
  const resp = await api.delete<any>(
    `/clients/${clientId}/limits/products/${productId}?period=${period}`
  );
  return resp;
}

/** Obtener un límite puntual (útil si necesitas cargar uno antes de editar) */
export async function getClientLimit(
  clientId: number,
  productId: number,
  period: PeriodKind
): Promise<ClientLimitRow | null> {
  const resp = await api.get<any>(
    `/clients/${clientId}/limits/products/${productId}?period=${period}`
  );
  if (!resp) return null;
  // algunos backends envían {row: ...} o {...directo}
  const row = resp.row ?? resp;
  return toCamel(row);
}

/** Uso del período (consumido vs. máximo) */
export async function getClientLimitUsage(
  clientId: number,
  productId: number,
  period: PeriodKind
): Promise<UsageResponse> {
  const resp = await api.get<any>(
    `/clients/${clientId}/limits/products/${productId}/usage?period=${period}`
  );

  // Mapear a camel y asegurar tipos numéricos
  return {
    clientId: Number(resp.client_id ?? resp.clientId ?? clientId),
    productId: Number(resp.product_id ?? resp.productId ?? productId),
    periodKind: (resp.period_kind ?? resp.periodKind ?? period) as PeriodKind,
    maxGallons:
      resp.max_gallons !== undefined && resp.max_gallons !== null
        ? Number(resp.max_gallons)
        : resp.maxGallons !== undefined && resp.maxGallons !== null
        ? Number(resp.maxGallons)
        : null,
    usedGallons: Number(resp.used_gallons ?? resp.usedGallons ?? 0),
    remainingGallons:
      resp.remaining_gallons !== undefined && resp.remaining_gallons !== null
        ? Number(resp.remaining_gallons)
        : resp.remainingGallons !== undefined &&
          resp.remainingGallons !== null
        ? Number(resp.remainingGallons)
        : null,
    applyToAllPayments: resp.apply_to_all_payments ?? resp.applyToAllPayments ?? null,
  };
}
