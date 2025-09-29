// src/services/creditService.ts
import apiService from './apiService';
import { Credit as Credito } from '../../app/grifo/types/dashboard';

/* ============================
   Tipos compartidos con backend
   ============================ */

export interface Credit {
  credit_id: number;
  client_id: number;
  sale_id?: number | null;
  driver_id?: number | null;            // 👈 NUEVO
  credit_amount: number;
  amount_paid: number;
  due_date: string;                     // ISO
  status: 'pending' | 'paid' | 'overdue';
  created_at: string;
  updated_at: string | null;

  client?: {
    client_id: number;
    name?: string;
    email?: string;
    phone?: string;
    company_name?: string;
  };
  sale?: {
    sale_id: number;
    total_amount?: number;
  };
  // 👇 NUEVO: info del conductor (si se cargó con relaciones)
  driver?: {
    driver_id: number;
    company_id: number;
    full_name: string;
    dni?: string | null;
    plate?: string | null;
    phone?: string | null;
  } | null;
}

export interface CreditsDashboard {
  total: number;    // (pendientes)
  overdue: number;
  paid: number;
}

export interface CreateCreditData {
  client_id: number;
  sale_id?: number | null;
  driver_id?: number | null;            // 👈 NUEVO (opcional)
  credit_amount: number;
  due_date: string; // ISO
}

export interface PaymentData {
  amount: number;
  payment_method_id?: number;
  user_id?: number;
  sale_id?: number | null;
  notes?: string;       // alias de reference
  reference?: string;   // preferido por el backend
}

// ====== Bulk payments ======
export interface BulkPaymentItem {
  credit_id: number;
  amount: number;
}
export interface BulkPaymentsBody {
  items: BulkPaymentItem[];         // 👈 importante: 'items'
  payment_method_id?: number;
  user_id?: number;
  notes?: string;                   // referencia/observaciones
}
export interface PaymentRow {
  payment_id: number;
  user_id: number;
  sale_id: number | null;
  credit_id: number | null;
  payment_timestamp: string;
  amount: number | string;
  payment_method_id: number;
  notes?: string | null;
  payment_type?: string | null;
  status: string;
}
export interface BulkPaymentsResponse {
  updated: Credit[];
  payments: PaymentRow[];
  count: number;
  totalAmount: number;
}

// ====== Auto allocate (pago automático por monto - por cliente) ======
export interface AutoAllocateBody {
  amount: number;
  payment_method_id: number;
  user_id: number;
  notes?: string;
  /** 'due' (default) | 'created' */
  order?: 'due' | 'created';
}
export interface AutoAllocateResponse {
  ok: boolean;
  totalRequested: number;
  allocated: number;
  leftover: number;
  payments: PaymentRow[];
  updatedCredits: Credit[];
}

/* ====== NUEVO: créditos por empresa agrupados por conductor ====== */
export interface CompanyCreditsGroup {
  company_id: number;
  company_name: string;
  totals: { pending: number; overdue: number; totalDebt: number };
  drivers: Array<{
    driver: {
      driver_id: number;
      full_name: string;
      dni?: string | null;
      plate?: string | null;
      phone?: string | null;
    } | null; // null = créditos sin conductor
    totalDebt: number;
    credits: Credit[];
  }>;
}

/* ====== NUEVO: autopago por empresa ====== */
export interface AutoPayCompanyBody {
  total_amount: number;
  payment_method_id?: number;
  user_id?: number;
  notes?: string;
  driver_ids?: number[]; // opcional: limitar a ciertos conductores
}
export interface AutoPayCompanyResponse {
  allocated: { credit_id: number; amount: number }[];
  leftover: number;
  result: BulkPaymentsResponse;
}

export interface CreditStats {
  totalCredits: number;
  totalDebt: number;
  clientsWithDebt: number;
  overdueCredits: number;
  paidCredits: number;
}

/* ============================
   Servicio
   ============================ */

class CreditService {
  private endpoint = '/credits';

  /**
   * Obtener todos los créditos con filtros opcionales (sin caché).
   * Ej: { status: 'pending' }, { overdue: true }, etc.
   */
  async getAllCredits(filters?: Record<string, any>): Promise<Credit[]> {
    // include=client (legacy) — el backend lo ignora, pero se mantiene por compat
    let url = `${this.endpoint}?include=client`;

    const params = new URLSearchParams();
    Object.entries(filters ?? {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      params.append(k, String(v));
    });
    params.append('_t', String(Date.now())); // cache buster

    const qs = params.toString();
    if (qs) url += `&${qs}`;

    return apiService.get<Credit[]>(url, { cache: 'no-store' } as RequestInit);
  }

  // Obtener un crédito por ID (sin caché)
  async getCreditById(id: number): Promise<Credit> {
    const url = `${this.endpoint}/${id}?_t=${Date.now()}`;
    return apiService.get<Credit>(url, { cache: 'no-store' } as RequestInit);
  }

  // Crear un nuevo crédito
  async createCredit(creditData: CreateCreditData): Promise<Credit> {
    return apiService.post<Credit>(this.endpoint, creditData);
  }

  // Dashboard de créditos (sin caché)
  async getCreditsDashboard(): Promise<CreditsDashboard> {
    const url = `${this.endpoint}/dashboard?_t=${Date.now()}`;
    return apiService.get<CreditsDashboard>(url, { cache: 'no-store' } as RequestInit);
  }

  // Créditos para el dashboard (sin caché)
  async getCreditsToDashboard(): Promise<Credito[]> {
    const url = `${this.endpoint}/credits-dashboard?_t=${Date.now()}`;
    return apiService.get<Credito[]>(url, { cache: 'no-store' } as RequestInit);
  }

  // Créditos vencidos (sin caché)
  async getOverdueCredits(): Promise<Credit[]> {
    const url = `${this.endpoint}/overdue?_t=${Date.now()}`;
    return apiService.get<Credit[]>(url, { cache: 'no-store' } as RequestInit);
  }

  /**
   * ✅ Pagar un crédito (UNITARIO)
   */
  async addPayment(creditId: number, payload: PaymentData): Promise<Credit> {
    const body = {
      amount: payload.amount,
      payment_method_id: payload.payment_method_id,
      user_id: payload.user_id,
      reference: payload.reference ?? payload.notes, // alias seguro
    };
    return apiService.post<Credit>(`${this.endpoint}/${creditId}/payments`, body);
  }

  /**
   * ✅ Pagar múltiples créditos (BULK)
   */
  async addPaymentsBulk(body: BulkPaymentsBody): Promise<BulkPaymentsResponse> {
    return apiService.post<BulkPaymentsResponse>(`${this.endpoint}/payments/bulk`, body);
  }

  /**
   * ✅ Pago automático por monto (cliente)
   */
  async autoAllocatePayment(
    clientId: number,
    body: AutoAllocateBody
  ): Promise<AutoAllocateResponse> {
    return apiService.post<AutoAllocateResponse>(
      `${this.endpoint}/clients/${clientId}/payments/auto`,
      body
    );
  }

  /* ====== NUEVO: créditos por EMPRESA (agrupados por conductor) ====== */
  async getCompanyCreditsGrouped(
    companyId: number,
    opts?: { onlyPending?: boolean }
  ): Promise<CompanyCreditsGroup> {
    const u = new URLSearchParams();
    if (opts?.onlyPending) u.set('onlyPending', 'true');
    const qs = u.toString();
    const url = `${this.endpoint}/company/${companyId}${qs ? `?${qs}` : ''}`;
    return apiService.get<CompanyCreditsGroup>(url, { cache: 'no-store' } as RequestInit);
  }

  /* ====== NUEVO: autopago por EMPRESA ====== */
  async autoPayCompany(
    companyId: number,
    body: AutoPayCompanyBody
  ): Promise<AutoPayCompanyResponse> {
    return apiService.post<AutoPayCompanyResponse>(
      `${this.endpoint}/company/${companyId}/payments/auto`,
      body
    );
  }

  // Obtener créditos pendientes (con deuda)
  async getPendingCredits(): Promise<Credit[]> {
    return this.getAllCredits({ status: 'pending' });
  }

  // Obtener créditos pagados
  async getPaidCredits(): Promise<Credit[]> {
    return this.getAllCredits({ status: 'paid' });
  }

  // Estadísticas calculadas locales (usa llamadas sin caché)
  async getCreditStats(): Promise<CreditStats> {
    const [allCredits, dashboard] = await Promise.all([
      this.getAllCredits(),
      this.getCreditsDashboard(),
    ]);

    const totalDebt = allCredits
      .filter((c) => c.status === 'pending' || c.status === 'overdue')
      .reduce((sum, c) => sum + (c.credit_amount - c.amount_paid), 0);

    const clientsWithDebt = new Set(
      allCredits
        .filter((c) => c.status === 'pending' || c.status === 'overdue')
        .map((c) => c.client_id)
    ).size;

    return {
      totalCredits: dashboard.total,
      totalDebt,
      clientsWithDebt,
      overdueCredits: dashboard.overdue,
      paidCredits: dashboard.paid,
    };
  }

  // Obtener créditos por cliente
  async getCreditsByClient(clientId: number): Promise<Credit[]> {
    const allCredits = await this.getAllCredits();
    return allCredits.filter((credit) => credit.client_id === clientId);
  }

  // Listado de clientes con deuda totalizada
  async getClientsWithDebt(): Promise<
    Array<{ client_id: number; name: string; totalDebt: number; creditsCount: number }>
  > {
    const credits = await this.getAllCredits();
    const clientsMap = new Map<
      number,
      { client_id: number; name: string; totalDebt: number; creditsCount: number }
    >();

    credits
      .filter((credit) => credit.status === 'pending' || credit.status === 'overdue')
      .forEach((credit) => {
        const clientId = credit.client_id;
        const debt = credit.credit_amount - credit.amount_paid;

        if (clientsMap.has(clientId)) {
          const existing = clientsMap.get(clientId)!;
          existing.totalDebt += debt;
          existing.creditsCount += 1;
        } else {
          clientsMap.set(clientId, {
            client_id: clientId,
            name:
              credit.client?.name ||
              credit.client?.company_name ||
              `Cliente ${clientId}`,
            totalDebt: debt,
            creditsCount: 1,
          });
        }
      });

    return Array.from(clientsMap.values());
  }

  // Health check simple
  async healthCheck(): Promise<boolean> {
    try {
      await apiService.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

export default new CreditService();
