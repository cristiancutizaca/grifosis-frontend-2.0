// employeeReportService.ts - Servicio actualizado para usar endpoints reales del backend
import ApiService from './apiService';

export interface EmployeeSale {
  sale_id: number;
  date: string;
  time: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: string;
  client_name?: string;
  pump_number?: number;
  nozzle_number?: number;
  shift_id?: number;
}

export interface EmployeeCredit {
  credit_id: number;
  date: string;
  client_name: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'pending' | 'partial' | 'paid';
  due_date: string;
  payment_date?: string;
  notes?: string;
}

export interface EmployeeInventoryMovement {
  movement_id: number;
  date: string;
  time: string;
  product_name: string;
  movement_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  tank_id?: number;
  previous_stock?: number;
  new_stock?: number;
}

export interface EmployeePerformanceStats {
  employee_id: number;
  employee_name: string;
  period: {
    start_date: string;
    end_date: string;
  };
  sales_summary: {
    total_sales: number;
    total_amount: number;
    total_transactions: number;
    average_sale: number;
    best_day: string;
    best_day_amount: number;
    sales_by_product: Array<{
      product_name: string;
      quantity: number;
      amount: number;
      transactions: number;
    }>;
    sales_by_payment_method: Array<{
      payment_method: string;
      transactions: number;
      amount: number;
    }>;
  };
  credits_summary: {
    credits_managed: number;
    total_credit_amount: number;
    credits_collected: number;
    total_collected_amount: number;
    pending_credits: number;
    pending_amount: number;
  };
  inventory_summary: {
    total_movements: number;
    movements_by_type: Array<{
      movement_type: string;
      count: number;
      total_quantity: number;
    }>;
    products_handled: string[];
  };
}

export interface EmployeeReportFilters {
  employee_id: number;
  start_date: string;
  end_date: string;
  include_sales?: boolean;
  include_credits?: boolean;
  include_inventory?: boolean;
  product_filter?: string;
  payment_method_filter?: string;
}

// Interfaz para la respuesta del backend del reporte detallado
export interface DetailedEmployeeReportResponse {
  employeeId: number;
  salesSummary: {
    totalSales?: number;
    salesCount?: number;
    rankingData?: Array<{
      name: string;
      orders: number;
      total: number;
    }>;
  };
  detailedSales: Array<{
    sale_id: number;
    sale_timestamp: string;
    total_amount: number;
    client?: {
      full_name?: string;
    };
    paymentMethod?: {
      method_name?: string;
    };
    saleDetails: Array<{
      quantity: number;
      unit_price_at_sale: number;
      subtotal: number;
      product: {
        name: string;
      };
    }>;
  }>;
  inventoryMovements: Array<{
    movement_id: number;
    movement_timestamp: string;
    movement_type: string;
    quantity: number;
    product: {
      name: string;
    };
    tank: {
      tank_name: string;
    };
  }>;
  collections: {
    totalCollections: number;
    collectionsDetails: Array<{
      payment_id: number;
      amount: number;
      payment_date: string;
      payment_method: string;
      client_name: string;
    }>;
  };
}

class EmployeeReportService {
  private readonly endpoint = '/reports';

  /**
   * Obtiene el reporte detallado de un empleado usando el endpoint real del backend
   */
  async getDetailedEmployeeReport(
    employeeId: number,
    startDate: string,
    endDate: string,
    format: 'json' | 'excel' | 'pdf' = 'json'
  ): Promise<DetailedEmployeeReportResponse> {
    try {
      const params = new URLSearchParams({
        employeeId: employeeId.toString(),
        startDate,
        endDate,
        format
      });

      const response = await ApiService.get<DetailedEmployeeReportResponse>(
        `${this.endpoint}/employee/detailed?${params}`
      );

      return response;
    } catch (error) {
      console.error('Error al obtener reporte detallado del empleado:', error);
      throw error;
    }
  }

  /**
   * Transforma la respuesta del backend al formato esperado por el componente
   */
  transformBackendResponse(backendResponse: DetailedEmployeeReportResponse): {
    sales: EmployeeSale[];
    credits: EmployeeCredit[];
    inventory: EmployeeInventoryMovement[];
    stats: EmployeePerformanceStats;
  } {
    // Transformar ventas detalladas
    const sales: EmployeeSale[] = backendResponse.detailedSales.flatMap(sale =>
      sale.saleDetails.map(detail => ({
        sale_id: sale.sale_id,
        date: sale.sale_timestamp.split('T')[0],
        time: sale.sale_timestamp.split('T')[1]?.substring(0, 8) || '00:00:00',
        product_name: detail.product.name,
        quantity: detail.quantity,
        unit_price: detail.unit_price_at_sale,
        total_amount: detail.subtotal,
        payment_method: sale.paymentMethod?.method_name || 'Efectivo',
        client_name: sale.client?.full_name || 'Consumidor Final'
      }))
    );

    // Transformar créditos (cobranzas)
    const credits: EmployeeCredit[] = backendResponse.collections.collectionsDetails.map(collection => ({
      credit_id: collection.payment_id,
      date: collection.payment_date.split('T')[0],
      client_name: collection.client_name,
      amount: collection.amount,
      paid_amount: collection.amount,
      remaining_amount: 0,
      status: 'paid' as const,
      due_date: collection.payment_date.split('T')[0]
    }));

    // Transformar movimientos de inventario
    const inventory: EmployeeInventoryMovement[] = backendResponse.inventoryMovements.map(movement => ({
      movement_id: movement.movement_id,
      date: movement.movement_timestamp.split('T')[0],
      time: movement.movement_timestamp.split('T')[1]?.substring(0, 8) || '00:00:00',
      product_name: movement.product.name,
      movement_type: movement.movement_type as 'in' | 'out' | 'adjustment',
      quantity: movement.quantity,
      reason: `Movimiento de ${movement.movement_type}`,
      tank_id: 1 // Valor por defecto, se puede mejorar si el backend lo proporciona
    }));

    // Calcular estadísticas
    const totalSales = sales.length;
    const totalAmount = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const averageSale = totalAmount / totalSales || 0;

    // Agrupar ventas por producto
    const salesByProduct = sales.reduce((acc, sale) => {
      const existing = acc.find(p => p.product_name === sale.product_name);
      if (existing) {
        existing.quantity += sale.quantity;
        existing.amount += sale.total_amount;
        existing.transactions += 1;
      } else {
        acc.push({
          product_name: sale.product_name,
          quantity: sale.quantity,
          amount: sale.total_amount,
          transactions: 1
        });
      }
      return acc;
    }, [] as Array<{ product_name: string; quantity: number; amount: number; transactions: number; }>);

    // Agrupar ventas por método de pago
    const salesByPaymentMethod = sales.reduce((acc, sale) => {
      const existing = acc.find(p => p.payment_method === sale.payment_method);
      if (existing) {
        existing.transactions += 1;
        existing.amount += sale.total_amount;
      } else {
        acc.push({
          payment_method: sale.payment_method,
          transactions: 1,
          amount: sale.total_amount
        });
      }
      return acc;
    }, [] as Array<{ payment_method: string; transactions: number; amount: number; }>);

    // Encontrar el mejor día
    const salesByDay = sales.reduce((acc, sale) => {
      const existing = acc.find(d => d.date === sale.date);
      if (existing) {
        existing.amount += sale.total_amount;
      } else {
        acc.push({ date: sale.date, amount: sale.total_amount });
      }
      return acc;
    }, [] as Array<{ date: string; amount: number; }>);

    const bestDay = salesByDay.reduce((best, current) => 
      current.amount > best.amount ? current : best, 
      { date: '', amount: 0 }
    );

    // Agrupar movimientos por tipo
    const movementsByType = inventory.reduce((acc, movement) => {
      const existing = acc.find(m => m.movement_type === movement.movement_type);
      if (existing) {
        existing.count += 1;
        existing.total_quantity += movement.quantity;
      } else {
        acc.push({
          movement_type: movement.movement_type,
          count: 1,
          total_quantity: movement.quantity
        });
      }
      return acc;
    }, [] as Array<{ movement_type: string; count: number; total_quantity: number; }>);

    const stats: EmployeePerformanceStats = {
      employee_id: backendResponse.employeeId,
      employee_name: 'Empleado', // Se puede obtener del contexto o hacer otra llamada
      period: {
        start_date: '', // Se puede pasar como parámetro
        end_date: ''
      },
      sales_summary: {
        total_sales: totalSales,
        total_amount: totalAmount,
        total_transactions: totalSales,
        average_sale: averageSale,
        best_day: bestDay.date,
        best_day_amount: bestDay.amount,
        sales_by_product: salesByProduct,
        sales_by_payment_method: salesByPaymentMethod
      },
      credits_summary: {
        credits_managed: credits.length,
        total_credit_amount: backendResponse.collections.totalCollections,
        credits_collected: credits.filter(c => c.status === 'paid').length,
        total_collected_amount: backendResponse.collections.totalCollections,
        pending_credits: credits.filter(c => c.status === 'pending').length,
        pending_amount: 0
      },
      inventory_summary: {
        total_movements: inventory.length,
        movements_by_type: movementsByType,
        products_handled: [...new Set(inventory.map(m => m.product_name))]
      }
    };

    return {
      sales,
      credits,
      inventory,
      stats
    };
  }

  /**
   * Obtiene un reporte completo del empleado usando el endpoint real
   */
  async getCompleteEmployeeReport(filters: EmployeeReportFilters): Promise<{
    sales: EmployeeSale[];
    credits: EmployeeCredit[];
    inventory: EmployeeInventoryMovement[];
    stats: EmployeePerformanceStats;
  }> {
    try {
      const backendResponse = await this.getDetailedEmployeeReport(
        filters.employee_id,
        filters.start_date,
        filters.end_date
      );

      return this.transformBackendResponse(backendResponse);
    } catch (error) {
      console.error('Error al obtener reporte completo del empleado:', error);
      throw error;
    }
  }

  /**
   * Exporta el reporte del empleado a PDF usando el endpoint real
   */
  async exportEmployeeReportToPDF(filters: EmployeeReportFilters): Promise<Blob> {
    try {
      const params = new URLSearchParams({
        employeeId: filters.employee_id.toString(),
        startDate: filters.start_date,
        endDate: filters.end_date,
        format: 'pdf'
      });

      const response = await fetch(`${ApiService.getBaseURL()}${this.endpoint}/employee/detailed?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Accept': 'application/pdf'
        }
      });

      if (!response.ok) {
        throw new Error('Error al exportar reporte');
      }

      return await response.blob();
    } catch (error) {
      console.error('Error al exportar reporte del empleado:', error);
      throw error;
    }
  }

  /**
   * Exporta el reporte del empleado a Excel usando el endpoint real
   */
  async exportEmployeeReportToExcel(filters: EmployeeReportFilters): Promise<Blob> {
    try {
      const params = new URLSearchParams({
        employeeId: filters.employee_id.toString(),
        startDate: filters.start_date,
        endDate: filters.end_date,
        format: 'excel'
      });

      const response = await fetch(`${ApiService.getBaseURL()}${this.endpoint}/employee/detailed?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });

      if (!response.ok) {
        throw new Error('Error al exportar reporte');
      }

      return await response.blob();
    } catch (error) {
      console.error('Error al exportar reporte del empleado:', error);
      throw error;
    }
  }

  // Métodos legacy mantenidos para compatibilidad (ahora usan el endpoint real)
  async getEmployeeSales(filters: EmployeeReportFilters): Promise<EmployeeSale[]> {
    const completeReport = await this.getCompleteEmployeeReport(filters);
    return completeReport.sales;
  }

  async getEmployeeCredits(filters: EmployeeReportFilters): Promise<EmployeeCredit[]> {
    const completeReport = await this.getCompleteEmployeeReport(filters);
    return completeReport.credits;
  }

  async getEmployeeInventoryMovements(filters: EmployeeReportFilters): Promise<EmployeeInventoryMovement[]> {
    const completeReport = await this.getCompleteEmployeeReport(filters);
    return completeReport.inventory;
  }

  async getEmployeePerformanceStats(filters: EmployeeReportFilters): Promise<EmployeePerformanceStats> {
    const completeReport = await this.getCompleteEmployeeReport(filters);
    return completeReport.stats;
  }
}

export default new EmployeeReportService();

