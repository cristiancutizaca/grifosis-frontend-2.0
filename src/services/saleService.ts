import apiService from './apiService';
import { Sale as Ventas, SalesTrend } from "../../app/grifo/types/dashboard"

export interface Sale {
  sale_id: number;
  client_id: number;
  employee_id: number;
  pump_id?: number;
  nozzle_id?: number;
  product_id?: number;
  quantity: number;
  unit_price: number;
  total_amount: number;           // ← valor calculado y devuelto por el backend
  discount_amount?: number;
  final_amount: number;           // ← fuente de verdad: SIEMPRE usar este en la UI
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
    name: string;
    email?: string;
  };
  employee?: {
    employee_id: number;
    name: string;
  };
}

/**
 * Nota importante:
 * - total_amount ahora es OPCIONAL: si no lo envías, el backend lo calcula (unit_price * quantity).
 * - NUNCA envíes final_amount desde el frontend; el backend lo recalcula y devuelve.
 */
export interface CreateSaleData {
  client_id: number;
  employee_id: number;
  pump_id?: number;
  nozzle_id?: number;
  product_id?: number;
  quantity: number;
  unit_price: number;
  total_amount?: number;          // ← opcional para delegar cálculo al backend
  discount_amount?: number;
  payment_method: string;
  payment_method_id?: number;
  notes?: string;
  shift?: string;
  applyDynamicPricing?: boolean;  // si lo activas, el backend ajusta montos
}

export interface SaleFilters {
  startDate?: string;
  endDate?: string;
  clientId?: number;
  productId?: number;
  status?: string;
  paymentMethod?: string;
  employeeId?: number;
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

class SaleService {
  private endpoint = '/sales';

  async getAllSales(filters?: SaleFilters): Promise<Sale[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;
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
   * - total_amount es opcional; si no lo mandas, el backend lo calcula con unit_price*quantity.
   */
  async createSale(saleData: CreateSaleData): Promise<Sale> {
    return apiService.post<Sale>(this.endpoint, saleData);
  }

  /**
   * Actualizar venta:
   * - Envía solo los campos que cambian (p.ej., quantity, unit_price, discount_amount).
   * - El backend recalcula total_amount/final_amount.
   */
  async updateSale(id: number, saleData: Partial<CreateSaleData>): Promise<Sale> {
    return apiService.patch<Sale>(`${this.endpoint}/${id}`, saleData);
  }

  /**
   * Anular venta:
   * - Debe ser PUT para coincidir con el controlador (@Put(':id/cancel')).
   */
  async cancelSale(id: number, reason: string): Promise<Sale> {
    return apiService.put<Sale>(`${this.endpoint}/${id}/cancel`, { reason });
  }

  async getSalesHistory(filters?: SaleFilters): Promise<{
    sales: Sale[];
    summary: {
      totalSales: number;
      totalAmount: number;
      averageTicket: number;
      salesByStatus: { [status: string]: number };
      salesByPaymentMethod: { [method: string]: number };
    }
  }> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${this.endpoint}/history?${queryString}` : `${this.endpoint}/history`;
    return apiService.get(url);
  }

  async getSalesStats(filters?: SaleFilters): Promise<SaleStats> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${this.endpoint}/stats?${queryString}` : `${this.endpoint}/stats`;
    return apiService.get<SaleStats>(url);
  }

  async getSalesByClient(clientId: number, filters?: Omit<SaleFilters, 'clientId'>): Promise<Sale[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${this.endpoint}/client/${clientId}?${queryString}` : `${this.endpoint}/client/${clientId}`;
    return apiService.get<Sale[]>(url);
  }

  async getSalesByEmployee(employeeId: number, filters?: Omit<SaleFilters, 'employeeId'>): Promise<Sale[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${this.endpoint}/employee/${employeeId}?${queryString}` : `${this.endpoint}/employee/${employeeId}`;
    return apiService.get<Sale[]>(url);
  }

  async calculateDynamicPricing(data: {
    basePrice: number;
    shift?: string;
    timestamp?: string;
  }): Promise<any> {
    return apiService.post(`${this.endpoint}/calculate-pricing`, data);
  }

  async getSalesReport(startDate?: string, endDate?: string): Promise<any> {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    const queryString = queryParams.toString();
    const url = queryString ? `${this.endpoint}/report?${queryString}` : `${this.endpoint}/report`;
    return apiService.get(url);
  }

  /**
   * Recientes:
   * - ahora apunta a /sales/recent para ser explícitos con el backend.
   */
  async getRecentSales(limit: number): Promise<Sale[]> {
    const safe = Math.max(1, Math.min(100, Math.floor(limit || 25)));
    return apiService.get<Sale[]>(`${this.endpoint}/recent?limit=${safe}`);
  }
}

export default new SaleService();
