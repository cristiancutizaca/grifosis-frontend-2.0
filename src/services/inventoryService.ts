import apiService from './apiService';

export interface Product {
  id: number;
  nombre: string;
  tipo: 'combustible' | 'aditivo' | 'accesorio';
  precio_compra: number;
  precio_venta: number;
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number;
  estado: 'activo' | 'inactivo';
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface InventoryMovement {
  id: number;
  producto_id: number;
  tipo_movimiento: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  precio_unitario: number;
  total: number;
  motivo: string;
  referencia?: string;
  empleado_id: number;
  fecha_movimiento: string;
  observaciones?: string;
}

export interface Tank {
  id: number;
  numero_tanque: string;
  producto_id: number;
  capacidad_total: number;
  nivel_actual: number;
  nivel_minimo: number;
  nivel_maximo: number;
  estado: 'activo' | 'mantenimiento' | 'fuera_servicio';
  fecha_ultima_medicion: string;
}

export interface CreateProductData {
  nombre: string;
  tipo: 'combustible' | 'aditivo' | 'accesorio';
  precio_compra: number;
  precio_venta: number;
  unidad_medida: string;
  stock_minimo: number;
  stock_maximo: number;
}

export interface CreateMovementData {
  producto_id: number;
  tipo_movimiento: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  precio_unitario: number;
  motivo: string;
  referencia?: string;
  empleado_id: number;
  observaciones?: string;
}

export interface UpdateTankData {
  nivel_actual: number;
  fecha_ultima_medicion?: string;
}

export interface InventoryAlert {
  id: number;
  producto_id: number;
  nombre_producto: string;
  tipo_alerta: 'stock_bajo' | 'stock_agotado' | 'tanque_bajo';
  mensaje: string;
  fecha_alerta: string;
  estado: 'activa' | 'resuelta';
}

class InventoryService {
  private endpoint = '/inventario';

  // Productos
  async getAllProducts(): Promise<Product[]> {
    return apiService.get<Product[]>(`${this.endpoint}/productos`);
  }

  async getProductById(id: number): Promise<Product> {
    return apiService.get<Product>(`${this.endpoint}/productos/${id}`);
  }

  async createProduct(productData: CreateProductData): Promise<Product> {
    return apiService.post<Product>(`${this.endpoint}/productos`, productData);
  }

  // async updateProduct(id: number, productData: Partial<CreateProductData>): Promise<Product> {
  //   return apiService.put<Product>(`${this.endpoint}/productos/${id}`, productData);
  // }

  async deleteProduct(id: number): Promise<void> {
    return apiService.delete<void>(`${this.endpoint}/productos/${id}`);
  }

  async getProductsByType(tipo: 'combustible' | 'aditivo' | 'accesorio'): Promise<Product[]> {
    return apiService.get<Product[]>(`${this.endpoint}/productos?tipo=${tipo}`);
  }

  async getLowStockProducts(): Promise<Product[]> {
    return apiService.get<Product[]>(`${this.endpoint}/productos/stock-bajo`);
  }

  // Movimientos de inventario
  async getInventoryMovements(productId?: number): Promise<InventoryMovement[]> {
    const url = productId 
      ? `${this.endpoint}/movimientos?producto_id=${productId}`
      : `${this.endpoint}/movimientos`;
    return apiService.get<InventoryMovement[]>(url);
  }

  async getMovementById(id: number): Promise<InventoryMovement> {
    return apiService.get<InventoryMovement>(`${this.endpoint}/movimientos/${id}`);
  }

  async createMovement(movementData: CreateMovementData): Promise<InventoryMovement> {
    const total = movementData.cantidad * movementData.precio_unitario;
    const movementWithTotal = { ...movementData, total };
    
    return apiService.post<InventoryMovement>(`${this.endpoint}/movimientos`, movementWithTotal);
  }

  async getMovementsByDateRange(fechaInicio: string, fechaFin: string): Promise<InventoryMovement[]> {
    return apiService.get<InventoryMovement[]>(
      `${this.endpoint}/movimientos?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`
    );
  }

  // Tanques
  async getAllTanks(): Promise<Tank[]> {
    return apiService.get<Tank[]>(`${this.endpoint}/tanques`);
  }

  async getTankById(id: number): Promise<Tank> {
    return apiService.get<Tank>(`${this.endpoint}/tanques/${id}`);
  }

  // async updateTankLevel(id: number, tankData: UpdateTankData): Promise<Tank> {
  //   return apiService.put<Tank>(`${this.endpoint}/tanques/${id}/nivel`, tankData);
  // }

  async getTanksByProduct(productId: number): Promise<Tank[]> {
    return apiService.get<Tank[]>(`${this.endpoint}/tanques?producto_id=${productId}`);
  }

  async getLowLevelTanks(): Promise<Tank[]> {
    return apiService.get<Tank[]>(`${this.endpoint}/tanques/nivel-bajo`);
  }

  // Alertas de inventario
  async getInventoryAlerts(): Promise<InventoryAlert[]> {
    return apiService.get<InventoryAlert[]>(`${this.endpoint}/alertas`);
  }

  async getActiveAlerts(): Promise<InventoryAlert[]> {
    return apiService.get<InventoryAlert[]>(`${this.endpoint}/alertas?estado=activa`);
  }

  // async resolveAlert(alertId: number): Promise<InventoryAlert> {
  //   return apiService.put<InventoryAlert>(`${this.endpoint}/alertas/${alertId}/resolver`, {});
  // }

  // Reportes y estadísticas
  async getInventoryReport(filters?: {
    fecha_inicio?: string;
    fecha_fin?: string;
    producto_id?: number;
    tipo_movimiento?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = queryParams.toString();
    const url = queryString ? `${this.endpoint}/reporte?${queryString}` : `${this.endpoint}/reporte`;
    
    return apiService.get<any>(url);
  }

  async getInventoryValue(): Promise<{ valor_total: number; productos: Array<{ producto_id: number; nombre: string; valor: number }> }> {
    return apiService.get<any>(`${this.endpoint}/valor-total`);
  }

  async getStockStatus(): Promise<{
    productos_stock_normal: number;
    productos_stock_bajo: number;
    productos_agotados: number;
    tanques_nivel_normal: number;
    tanques_nivel_bajo: number;
  }> {
    return apiService.get<any>(`${this.endpoint}/estado-stock`);
  }
}

const inventoryService = new InventoryService();
export default inventoryService;

