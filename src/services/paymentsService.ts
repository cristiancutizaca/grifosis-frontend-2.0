// src/services/paymentsService.ts
import apiService from './apiService';

/* ===================== Tipos base ===================== */
export type PaymentRecord = {
  payment_id: number;
  user_id: number;
  sale_id: number | null;
  credit_id: number | null;
  payment_timestamp: string;
  amount: string | number;
  payment_method_id: number;
  notes: string | null;
  payment_type: 'credit' | null;
  status: string;
};

export type PaymentsListResponse = PaymentRecord[];

/* ===================== Pago unitario (POST /payments) ===================== */
/** Unión estricta con `never` para evitar mezclar sale_id/credit_id */
export type CreatePaymentPayload =
  | {
      // PAGO DE CRÉDITO
      credit_id: number;
      sale_id?: never; // asegura que NO venga sale_id
      amount: number;
      payment_method_id: number;
      user_id: number;
      notes?: string;
      /** alias opcional; lo normalizamos a notes */
      reference?: string;
    }
  | {
      // PAGO DE VENTA
      sale_id: number;
      credit_id?: never; // asegura que NO venga credit_id
      amount: number;
      payment_method_id: number;
      user_id: number;
      notes?: string;
      /** alias opcional; lo normalizamos a notes */
      reference?: string;
    };

/** Normaliza `reference` -> `notes` para compatibilidad hacia atrás */
export const createPayment = (payload: CreatePaymentPayload) => {
  const { reference, ...rest } = payload as any;
  const body = reference ? { ...rest, notes: rest.notes ?? reference } : rest;
  return apiService.post('/payments', body);
};

/* ============= Pago unitario por crédito (POST /credits/:id/payments) ============= */
export type CreateCreditPaymentPayload = {
  credit_id: number;
  amount: number;
  payment_method_id: number;
  user_id: number;
  notes?: string;
  reference?: string; // alias opcional
};

export const createCreditPayment = (payload: CreateCreditPaymentPayload) => {
  const { credit_id, notes, reference, ...rest } = payload;
  const body: any = { ...rest };
  if (notes?.trim()) body.notes = notes.trim();
  else if (reference?.trim()) body.notes = reference.trim();
  if (reference?.trim()) body.reference = reference.trim(); // por si el backend lo usa
  return apiService.post(`/credits/${credit_id}/payments`, body);
};

/* ============= Pago múltiple (POST /credits/payments/bulk) ============= */
/**
 * El backend espera: { items: [{ credit_id, amount }], payment_method_id, user_id, notes? }
 * La UI puede armar `payments` o `items`; aquí SIEMPRE enviamos `items`.
 */
export type CreatePaymentsBulkPayload = {
  payments?: { credit_id: number | string; amount: number | string }[];
  items?: { credit_id: number | string; amount: number | string }[];
  payment_method_id: number;
  user_id: number;
  notes?: string;
};

export type BulkPaymentsResponse = {
  count: number;
  totalAmount: number;
  payments: PaymentRecord[];
  // algunos backends devuelven también créditos actualizados:
  updated?: any[];
  updatedCredits?: any[];
};

export const createPaymentsBulk = (payload: CreatePaymentsBulkPayload) => {
  const raw = payload.items?.length ? payload.items : (payload.payments ?? []);
  const items = raw
    .map((p) => ({
      credit_id: Number(p.credit_id),
      amount: Number(p.amount),
    }))
    .filter(
      (p) =>
        Number.isFinite(p.credit_id) &&
        p.credit_id > 0 &&
        Number.isFinite(p.amount) &&
        p.amount > 0
    );

  const body = {
    items,
    payment_method_id: payload.payment_method_id,
    user_id: payload.user_id,
    notes: payload.notes?.trim() || undefined,
  };

  return apiService.post<BulkPaymentsResponse>('/credits/payments/bulk', body);
};

/* ===================== Helpers de consulta ===================== */
export const listPaymentsByCredit = (creditId: number) =>
  apiService.get<PaymentsListResponse>(`/payments?credit_id=${creditId}`);

/* ======= Lo que subieron al repo: pagos recientes de créditos ======= */
export type CreditPaymentItem = {
  paymentId: number;
  amount: number;
  method: string;
  timestamp: string;
  creditId: number | null;
  clientName: string;
  saleId: number | null;
  status: string;
};

export async function getRecentCreditPayments(page = 1, pageSize = 10) {
  // armamos query a mano por compatibilidad con apiService
  const path = `/payments/credit/recent?page=${page}&pageSize=${pageSize}`;
  const data = await apiService.get(path);
  return data as {
    items: CreditPaymentItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

/* ===================== Export por defecto ===================== */
const paymentsService = {
  createPayment,
  createCreditPayment,
  createPaymentsBulk,
  listPaymentsByCredit,
  getRecentCreditPayments,
};

export default paymentsService;
