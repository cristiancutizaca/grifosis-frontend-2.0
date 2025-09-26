'use client';

import { api } from './../services/apiService';

export type GroupKind = 'day' | 'week' | 'month';

export interface ClientSummaryRow {
  period: string;
  client_id: number;
  client_label: string;
  sales: number;
  gallons: string;
  revenue: string;
  discount_total: string;
  tax_total: string;
  revenue_credit: string;
  revenue_cash: string;
}

export interface ClientDetailRow {
  sale_id: number;
  sale_timestamp: string;
  client_id: number;
  client_label: string;
  product_id: number;
  product_name: string;
  gallons: string;
  unit_price: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  subtotal: string;
  payment_method: string;
  is_credit: boolean;
}

/** Sugerencia que muestra el buscador */
export interface ClientSuggestion {
  client_id: number;
  document_number?: string | null;
  display_name: string; // primero persona (first + last), luego empresa
  label: string;        // "dni / display_name"
}

/** Construye el display con prioridad PERSONA -> EMPRESA */
function buildPersonFirstDisplay(c: any): string {
  const first = (c?.first_name ?? '').toString().trim();
  const last = (c?.last_name ?? '').toString().trim();
  const full = [first, last].filter(Boolean).join(' ');
  if (full) return full;

  const company = (c?.company_name ?? '').toString().trim();
  if (company) return company;

  const backendDisplay = (c?.display_name ?? c?.name ?? '').toString().trim();
  return backendDisplay || '(sin nombre)';
}

/** Normaliza cualquier payload a ClientSuggestion usando PERSONA primero */
function mapToSuggestion(c: any): ClientSuggestion {
  const display = buildPersonFirstDisplay(c);
  const dni = c?.document_number ?? null;
  const idRaw = c?.client_id ?? c?.id ?? c?.clientId;
  return {
    client_id: Number(idRaw),
    document_number: dni,
    display_name: display,
    label: dni ? `${dni} / ${display}` : display,
  };
}

/** Busca clientes por nombre/apellido o DNI con fallback seguro */
export async function searchClients(term: string): Promise<ClientSuggestion[]> {
  const q = (term ?? '').trim();
  if (!q) return [];

  // 1) Preferido: módulo REPORTS que ya busca por nombres/apellidos
  try {
    const raw = await api.get<any[]>(
      `/reports/clients/suggest?q=${encodeURIComponent(q)}&limit=10`
    );
    return (raw ?? []).map(mapToSuggestion);
  } catch {
    // 2) Compat: /clients?search=...
    try {
      const raw = await api.get<any[]>(
        `/clients?search=${encodeURIComponent(q)}&limit=10`
      );
      return (raw ?? []).map(mapToSuggestion);
    } catch {
      // 3) Último fallback: /clients/search?q=...
      try {
        const raw = await api.get<any[]>(
          `/clients/search?q=${encodeURIComponent(q)}&limit=10`
        );
        return (raw ?? []).map(mapToSuggestion);
      } catch {
        return [];
      }
    }
  }
}

/** Resumen por periodo */
export async function getClientSalesSummary(
  clientId: number,
  fromISO: string,
  toISO: string,
  group: GroupKind = 'day',
): Promise<ClientSummaryRow[]> {
  const qs = new URLSearchParams({ from: fromISO, to: toISO, group }).toString();
  return api.get<ClientSummaryRow[]>(`/reports/clients/${clientId}/sales/summary?${qs}`);
}

/** Detalle de ventas del cliente */
export async function getClientSalesDetail(
  clientId: number,
  fromISO: string,
  toISO: string,
): Promise<ClientDetailRow[]> {
  const qs = new URLSearchParams({ from: fromISO, to: toISO }).toString();
  return api.get<ClientDetailRow[]>(`/reports/clients/${clientId}/sales/detail?${qs}`);
}
// ====== Descarga de Excel (usa endpoints del backend) ======
function authHeaders(): HeadersInit {
  const h = new Headers();
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) h.set('Authorization', `Bearer ${token}`);
  }
  return h;
}

/** Descarga Excel del RESUMEN por cliente */
export async function downloadClientSummaryExcel(
  clientId: number,
  fromISO: string,
  toISO: string,
  group: GroupKind = 'day',
): Promise<void> {
  // api.getBaseURL() viene de tu ApiService
  const base = (api as any).getBaseURL ? (api as any).getBaseURL() : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api');
  const qs = new URLSearchParams({ from: fromISO, to: toISO, group }).toString();
  const url = `${base}/reports/clients/${clientId}/sales/summary.xlsx?${qs}`;

  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`Fallo la descarga (${resp.status})`);

  const blob = await resp.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = `cliente_${clientId}_ventas_resumen_${group}_${fromISO}_${toISO}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(objUrl);
}

/** Descarga Excel del DETALLE por cliente */
export async function downloadClientDetailExcel(
  clientId: number,
  fromISO: string,
  toISO: string,
): Promise<void> {
  const base = (api as any).getBaseURL ? (api as any).getBaseURL() : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api');
  const qs = new URLSearchParams({ from: fromISO, to: toISO }).toString();
  const url = `${base}/reports/clients/${clientId}/sales/detail.xlsx?${qs}`;

  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`Fallo la descarga (${resp.status})`);

  const blob = await resp.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = `cliente_${clientId}_ventas_detalle_${fromISO}_${toISO}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(objUrl);
}
