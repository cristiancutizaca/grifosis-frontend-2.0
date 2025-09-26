// src/services/clientLimitsService.ts
'use client';

import api from './apiService';

export type PeriodKind = 'day' | 'week' | 'month'; // (rolling_30d no está en el backend actual)

export interface ClientLimitRow {
  id: number;
  clientId: number;
  productId: number;
  productName?: string;
  periodKind: PeriodKind;
  maxGallons: number;
  applyToAllPayments: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

// ---- helpers ----
function normalizeArray<T = any>(resp: any): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (Array.isArray(resp?.rows)) return resp.rows as T[];
  if (Array.isArray(resp?.data)) return resp.data as T[];
  if (Array.isArray(resp?.items)) return resp.items as T[];
  return [];
}

// ======================= API =======================

/** Listar límites de un cliente (siempre retorna array) */
export async function listClientLimits(
  clientId: number,
  opts?: { productId?: number; periodKind?: PeriodKind; onlyActive?: boolean }
): Promise<ClientLimitRow[]> {
  const qs = new URLSearchParams();
  if (opts?.productId) qs.set('productId', String(opts.productId));
  if (opts?.periodKind) qs.set('periodKind', opts.periodKind);
  if (typeof opts?.onlyActive === 'boolean') qs.set('onlyActive', String(opts.onlyActive));

  const resp = await api.get<any>(
    `/clients/${clientId}/limits${qs.toString() ? `?${qs}` : ''}`
  );
  // El backend ya responde en camelCase → no hay que mapear keys
  const rows = normalizeArray<ClientLimitRow>(resp);
  // Asegurar tipos numéricos
  return rows.map(r => ({ ...r, maxGallons: Number(r.maxGallons) }));
}

/** Crear/actualizar límite (camelCase al backend) */
export function upsertClientLimit(
  clientId: number,
  productId: number,
  body: {
    periodKind: PeriodKind;
    maxGallons: number;
    applyToAllPayments?: boolean;
    isActive?: boolean;
  }
) {
  return api.put<ClientLimitRow>(
    `/clients/${clientId}/limits/products/${productId}`,
    {
      periodKind: body.periodKind,
      maxGallons: Number(body.maxGallons),
      applyToAllPayments: body.applyToAllPayments ?? true,
      isActive: body.isActive ?? true,
    }
  );
}

/** Activar/desactivar (opcional pasar period para afectar solo ese período) */
export function setClientLimitActive(
  clientId: number,
  productId: number,
  isActive: boolean,
  period?: PeriodKind
) {
  const qs = period ? `?period=${period}` : '';
  return api.patch<ClientLimitRow[]>(
    `/clients/${clientId}/limits/products/${productId}/active${qs}`,
    { isActive }
  );
}

/**
 * “Eliminar” → no tenemos DELETE en backend.
 * Implementamos como desactivar el período indicado.
 */
export async function deleteClientLimit(
  clientId: number,
  productId: number,
  period: PeriodKind
) {
  await setClientLimitActive(clientId, productId, false, period);
  return { deactivated: true };
}

/**
 * Detalle único: no hay endpoint dedicado en backend actual.
 * Si necesitas uno, usamos list con filtros y tomamos el primero.
 */
export async function getClientLimit(
  clientId: number,
  productId: number,
  period: PeriodKind
) {
  const rows = await listClientLimits(clientId, { productId, periodKind: period });
  return rows[0];
}

/**
 * Uso del período: si aún no tienes endpoint en backend,
 * esta función fallará y el UI mostrará “err”.
 * Si luego agregas /usage, quedará plug-and-play.
 */
export function getClientLimitUsage(
  clientId: number,
  productId: number,
  period: PeriodKind
) {
  // Ajusta esta ruta cuando implementes el endpoint real en backend
  return api.get<UsageResponse>(
    `/clients/${clientId}/limits/products/${productId}/usage?period=${period}`
  );
}
