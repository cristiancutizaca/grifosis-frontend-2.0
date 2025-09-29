// src/services/saleService.ts
import apiService from './apiService';
import { Sale as Ventas, SalesTrend } from "../../app/grifo/types/dashboard";

/* ===================== Tipos ===================== */

export interface Sale {
  sale_id: number;
  client_id: number | null;
  /** 👇 NUEVO: conductor asociado (solo si el cliente es empresa) */
  driver_id?: number | null;

  employee_id: number;
  pump_id?: number;
  nozzle_id?: number;
  product_id?: number;

  /** Cantidad (algunas vistas la usan) — ver también volume_gallons */
  quantity: number;

  /** Precio unitario (con IGV) */
  unit_price: number;

  /** Base (sin IGV). El backend la recalcula y la devuelve. */
  total_amount: number;

  discount_amount?: number;

  /** Fuente de verdad total cobrado (con IGV). ¡Usar este en UI! */
  final_amount: number;

  /** Nombre del método (si backend lo envía). Preferir payment_method_id si usas IDs. */
  payment_method: string;
  payment_method_id?: number;

  status: 'completed' | 'pending' | 'cancelled';
  sale_timestamp: string;
  created_at: string;
  notes?: string;
  shift?: string;
  user_id?: number;

  client?: {
    client_id: number;
    name?: string;
    email?: string;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };

  /** 👇 NUEVO: datos del conductor si el backend los relaciona en respuestas */
  driver?: {
    driver_id: number;
    full_name: string;
    plate?: string | null;
    dni?: string | null;
  };

  employee?: {
    employee_id: number;
    name: string;
  };
}

/**
 * Nota:
 * - No envíes final_amount desde el front; el backend lo calcula.
 * - total_amount puede omitirse; el backend lo calcula.
 * - Para combustibles, el backend entiende unit_price + volume_gallons + igv_rate + (opcional) gross_amount.
 */
export interface CreateSaleData {
  client_id?: number | null;
  /** 👇 NUEVO: si el cliente es empresa puedes enviar el driver_id */
  driver_id?: number | null;

  employee_id?: number | null;
  pump_id?: number;
  nozzle_id?: number;

  /** Alias legacy: quantity (puedes seguir usándolo) */
  quantity?: number;

  /** Precio unitario (con IGV) */
  unit_price?: number;

  /** Base (sin IGV) — opcional; el backend lo recalcula */
  total_amount?: number;

  discount_amount?: number;

  /** Método por nombre o por id */
  payment_method?: string;
  payment_method_id?: number;

  notes?: string;
  shift?: string;

  /** Activar reglas dinámicas (si usas esa feature) */
  applyDynamicPricing?: boolean;

  /** 👇 Campos que el backend ya soporta para combustible */
  volume_gallons?: number;   // preferido en lugar de quantity
  igv_rate?: number;         // ej. 0.18
  gross_amount?: number;     // bruto pre-descuento (con IGV)

  /** Si es crédito, fecha de vencimiento (ISO) */
  due_date?: string;
}

export interface SaleFilters {
  startDate?: string;
  endDate?: string;
  clientId?: number;
  /** 👇 NUEVO: filtro por conductor */
  driverId?: number;
  productId?: number;
  status?: string;
  paymentMethod?: string;
  employeeId?: number;
  /** 👇 opcional: para pedir recientes directo del /sales si no hay filtros */
  limit?: number;
}

export interface SaleStats {
  totalSales: number;
  totalAmount: number;
  averageTicket: number;
  salesByStatus: { [status: string]: number };
  salesByPaymentMethod: { [method: string]: number };
  salesByDay: { [day: string]: number };
  salesByHour: { [hour: number]: number };
  topClients: Array<{
    client_id: number;
    name: string;
    total_sales: number;
    total_amount: number;
  }>;
}

/* ===================== Servicio ===================== */

class SaleService {
  private endpoint = '/sales';

  /** Listado general (si pasas limit SIN filtros, backend devuelve recientes) */
  async getAllSales(filters?: SaleFilters): Promise<Sale[]> {
    const qp = new URLSearchParams();
    if (filters) {
      if (filters.startDate)     qp.append('startDate', String(filters.startDate));
      if (filters.endDate)       qp.append('endDate', String(filters.endDate));
      if (filters.clientId != null)   qp.append('clientId', String(filters.clientId));
      if (filters.driverId != null)   qp.append('driverId', String(filters.driverId)); // 👈 NUEVO
      if (filters.productId != null)  qp.append('productId', String(filters.productId));
      if (filters.status)        qp.append('status', String(filters.status));
      if (filters.paymentMethod) qp.append('paymentMethod', String(filters.paymentMethod));
      if (filters.employeeId != null) qp.append('employeeId', String(filters.employeeId));
      if (filters.limit != null) qp.append('limit', String(Math.max(1, Math.min(100, +filters.limit || 25))));
    }
    const url = qp.toString() ? `${this.endpoint}?${qp.toString()}` : this.endpoint;
    return apiService.get<Sale[]>(url);
  }

  async getSalesThisYear(): Promise<Ventas[]> {
    return apiService.get<Ventas[]>(`${this.endpoint}/this-year`);
  }

  async getSalesTrend(): Promise<SalesTrend[]> {
    return apiService.get<SalesTrend[]>(`${this.endpoint}/trends`);
  }

  async getSaleById(id: number): Promise<Sale> {
    return apiService.get<Sale>(`${this.endpoint}/${id}`);
  }

  /**
   * Crear venta:
   * - No envíes final_amount; el backend lo calcula y devuelve.
   * - total_amount puede omitirse; el backend la recalcula.
   * - Para empresa puedes enviar driver_id (valida que pertenezca a esa empresa).
   */
  async createSale(saleData: CreateSaleData): Promise<Sale> {
    return apiService.post<Sale>(this.endpoint, saleData);
  }

  /** Actualizar venta (backend recalcula totales) */
  async updateSale(id: number, saleData: Partial<CreateSaleData>): Promise<Sale> {
    return apiService.patch<Sale>(`${this.endpoint}/${id}`, saleData);
  }

  /** Anular venta (PUT para coincidir con el controlador) */
  async cancelSale(id: number, reason: string): Promise<Sale> {
    return apiService.put<Sale>(`${this.endpoint}/${id}/cancel`, { reason });
  }

  /** Historial con resumen (si tienes estos endpoints expuestos) */
  async getSalesHistory(filters?: SaleFilters): Promise<{
    sales: Sale[];
    summary: {
      totalSales: number;
      totalAmount: number;
      averageTicket: number;
      salesByStatus: { [status: string]: number };
      salesByPaymentMethod: { [method: string]: number };
    };
  }> {
    const qp = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && k !== 'limit') {
          qp.append(k, String(v));
        }
      });
    }
    const url = qp.toString() ? `${this.endpoint}/history?${qp.toString()}` : `${this.endpoint}/history`;
    return apiService.get(url);
  }

  async getSalesStats(filters?: SaleFilters): Promise<SaleStats> {
    const qp = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && k !== 'limit') {
          qp.append(k, String(v));
        }
      });
    }
    const url = qp.toString() ? `${this.endpoint}/stats?${qp.toString()}` : `${this.endpoint}/stats`;
    return apiService.get<SaleStats>(url);
  }

  /** Por cliente (si conservas estos endpoints antiguos) */
  async getSalesByClient(clientId: number, filters?: Omit<SaleFilters, 'clientId'>): Promise<Sale[]> {
    const qp = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && k !== 'limit') {
          qp.append(k, String(v));
        }
      });
    }
    const url = qp.toString()
      ? `${this.endpoint}/client/${clientId}?${qp.toString()}`
      : `${this.endpoint}/client/${clientId}`;
    return apiService.get<Sale[]>(url);
  }

  /** Por empleado (si conservas estos endpoints antiguos) */
  async getSalesByEmployee(employeeId: number, filters?: Omit<SaleFilters, 'employeeId'>): Promise<Sale[]> {
    const qp = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && k !== 'limit') {
          qp.append(k, String(v));
        }
      });
    }
    const url = qp.toString()
      ? `${this.endpoint}/employee/${employeeId}?${qp.toString()}`
      : `${this.endpoint}/employee/${employeeId}`;
    return apiService.get<Sale[]>(url);
  }

  /** 👇 NUEVO: helper directo por conductor usando el listado general */
  async getSalesByDriver(driverId: number, filters?: Omit<SaleFilters, 'driverId'>): Promise<Sale[]> {
    return this.getAllSales({ ...(filters || {}), driverId });
  }

  /** Calculadora de precios dinámicos (si usas ese endpoint) */
  async calculateDynamicPricing(data: {
    basePrice: number;
    shift?: string;
    timestamp?: string;
  }): Promise<any> {
    return apiService.post(`${this.endpoint}/calculate-pricing`, data);
  }

  async getSalesReport(startDate?: string, endDate?: string): Promise<any> {
    const qp = new URLSearchParams();
    if (startDate) qp.append('startDate', startDate);
    if (endDate) qp.append('endDate', endDate);
    const url = qp.toString() ? `${this.endpoint}/report?${qp.toString()}` : `${this.endpoint}/report`;
    return apiService.get(url);
  }

  /** Recientes explícitos */
  async getRecentSales(limit: number): Promise<Sale[]> {
    const safe = Math.max(1, Math.min(100, Math.floor(limit || 25)));
    return apiService.get<Sale[]>(`${this.endpoint}/recent?limit=${safe}`);
  }

  /** (Opcional) Endpoints públicos si los usas en algún lado */
  async getPublicData() {
    return apiService.get(`${this.endpoint}/public-data`);
  }
  async getPublicData2(limit = 50) {
    const safe = Math.max(1, Math.min(500, Math.floor(limit || 50)));
    return apiService.get(`${this.endpoint}/public-data2?limit=${safe}`);
  }
}

export default new SaleService();
