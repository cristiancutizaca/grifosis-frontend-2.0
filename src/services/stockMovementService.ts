import { stock_movements } from '../../app/grifo-inventario/types/movimiento_stock'
import ApiService from "./apiService";

class StockMovementService {
    private api = ApiService;
    private baseEndpoint = '/stock-movements';

    async createStockMovement(stockMovementData: any): Promise<stock_movements> {
        return await this.api.post<stock_movements>(`${this.baseEndpoint}`, stockMovementData);
    }

    async getAllStockMovement(): Promise<stock_movements[]> {
        return await this.api.get<stock_movements[]>(`${this.baseEndpoint}`);
    }
}

const stockMovementService = new StockMovementService();
export default stockMovementService;