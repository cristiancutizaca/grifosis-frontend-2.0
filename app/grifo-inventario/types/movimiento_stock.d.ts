type TipoMovimiento = 'Entrada' | 'Salida' | 'Ajuste';

export interface stock_movements {
    stock_movement_id: number;
    product_id: number;
    tank_id: number;
    user_id: number;
    movement_timestamp: string;
    movement_type: TipoMovimiento;
    quantity: number;
    sale_detail_id: number | null;
    delivery_detail_id: number | null;
    description: string;
}