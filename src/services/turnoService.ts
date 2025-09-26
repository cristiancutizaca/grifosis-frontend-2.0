import ApiService from './apiService'; // CORREGIDO: Importación por defecto

export interface Turno {
    turno_id: number;
    user_id: number;
    fecha_inicio: string;
    fecha_fin?: string;
    monto_inicial: number;
    monto_final?: number;
    estado: 'activo' | 'finalizado';
    ventas_realizadas?: VentaTurno[];
    productos_consumidos?: ProductoConsumido[];
    productos_recibidos?: ProductoRecibido[];
    created_at: string;
    updated_at: string;
}

export interface VentaTurno {
    venta_id: number;
    turno_id: number;
    tipo_combustible: 'regular' | 'premium' | 'diesel';
    cantidad_galones: number;
    precio_por_galon: number;
    total_venta: number;
    fecha_venta: string;
    created_at: string;
}

export interface ProductoConsumido {
    consumo_id: number;
    turno_id: number;
    tipo_producto: string;
    cantidad: number;
    unidad: string;
    fecha_consumo: string;
    created_at: string;
}

export interface ProductoRecibido {
    recepcion_id: number;
    turno_id: number;
    proveedor: string;
    tipo_producto: string;
    cantidad: number;
    unidad: string;
    fecha_recepcion: string;
    created_at: string;
}

export interface CreateTurnoDto {
    user_id: number;
    monto_inicial: number;
}

export interface UpdateTurnoDto {
    monto_final?: number;
    estado?: 'activo' | 'finalizado';
}

export interface CreateVentaDto {
    turno_id: number;
    tipo_combustible: 'regular' | 'premium' | 'diesel';
    cantidad_galones: number;
    precio_por_galon: number;
    total_venta: number;
}

export interface CreateProductoConsumidoDto {
    turno_id: number;
    tipo_producto: string;
    cantidad: number;
    unidad: string;
}

export interface CreateProductoRecibidoDto {
    turno_id: number;
    proveedor: string;
    tipo_producto: string;
    cantidad: number;
    unidad: string;
}

class TurnoService {
    // Gestión de turnos
    async iniciarTurno(data: CreateTurnoDto): Promise<Turno> {
        return await ApiService.post<Turno>('/turnos', data);
    }

    async finalizarTurno(turnoId: number, data: UpdateTurnoDto): Promise<Turno> {
        return await ApiService.put<Turno>(`/turnos/${turnoId}`, data);
    }

    async getTurnoActivo(userId: number): Promise<Turno | null> {
        try {
            return await ApiService.get<Turno>(`/turnos/activo/${userId}`);
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null; // No hay turno activo
            }
            throw error;
        }
    }

    async getTurnos(userId?: number): Promise<Turno[]> {
        const endpoint = userId ? `/turnos/usuario/${userId}` : '/turnos';
        return await ApiService.get<Turno[]>(endpoint);
    }

    async getTurno(turnoId: number): Promise<Turno> {
        return await ApiService.get<Turno>(`/turnos/${turnoId}`);
    }

    // Gestión de ventas en turno
    async registrarVenta(data: CreateVentaDto): Promise<VentaTurno> {
        return await ApiService.post<VentaTurno>('/turnos/ventas', data);
    }

    async getVentasTurno(turnoId: number): Promise<VentaTurno[]> {
        return await ApiService.get<VentaTurno[]>(`/turnos/${turnoId}/ventas`);
    }

    // Gestión de productos consumidos
    async registrarConsumo(data: CreateProductoConsumidoDto): Promise<ProductoConsumido> {
        return await ApiService.post<ProductoConsumido>('/turnos/consumos', data);
    }

    async getConsumosTurno(turnoId: number): Promise<ProductoConsumido[]> {
        return await ApiService.get<ProductoConsumido[]>(`/turnos/${turnoId}/consumos`);
    }

    // Gestión de productos recibidos
    async registrarRecepcion(data: CreateProductoRecibidoDto): Promise<ProductoRecibido> {
        return await ApiService.post<ProductoRecibido>('/turnos/recepciones', data);
    }

    async getRecepcionesTurno(turnoId: number): Promise<ProductoRecibido[]> {
        return await ApiService.get<ProductoRecibido[]>(`/turnos/${turnoId}/recepciones`);
    }

    // Utilidades
    async calcularResumenTurno(turnoId: number) {
        const [ventas, consumos, recepciones] = await Promise.all([
            this.getVentasTurno(turnoId),
            this.getConsumosTurno(turnoId),
            this.getRecepcionesTurno(turnoId)
        ]);

        const totalVentas = ventas.reduce((sum, venta) => sum + venta.total_venta, 0);
        const totalGalones = ventas.reduce((sum, venta) => sum + venta.cantidad_galones, 0);

        const ventasPorTipo = ventas.reduce((acc, venta) => {
            if (!acc[venta.tipo_combustible]) {
                acc[venta.tipo_combustible] = { galones: 0, total: 0 };
            }
            acc[venta.tipo_combustible].galones += venta.cantidad_galones;
            acc[venta.tipo_combustible].total += venta.total_venta;
            return acc;
        }, {} as Record<string, { galones: number; total: number }>);

        return {
            totalVentas,
            totalGalones,
            ventasPorTipo,
            consumos,
            recepciones,
            cantidadVentas: ventas.length
        };
    }
}

export const turnoService = new TurnoService();