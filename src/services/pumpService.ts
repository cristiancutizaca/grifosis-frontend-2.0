import { Surtidores } from '../../app/grifo-inventario/types/surtidores';
import ApiService from './apiService';

class PumpService {
  private api = ApiService;
  private baseEndpoint = '/pumps';

  async getAllPumps(): Promise<Surtidores[]> {
    return await this.api.get<Surtidores[]>(`${this.baseEndpoint}`);
  }

  async getPumpById(id: number): Promise<Surtidores> {
    return await this.api.get<Surtidores>(`${this.baseEndpoint}/${id}`);
  }

  async createPump(pumpData: Partial<Surtidores>): Promise<Surtidores> {
    return await this.api.post<Surtidores>(`${this.baseEndpoint}`, pumpData);
  }

  async updatePump(id: number, pumpData: Partial<Surtidores>): Promise<Surtidores> {
    return await this.api.patch<Surtidores>(`${this.baseEndpoint}/${id}`, pumpData);
  }

  async deletePump(id: number): Promise<void> {
    await this.api.delete<void>(`${this.baseEndpoint}/${id}`);
  }

  async healthCheckPumps(): Promise<boolean> {
    try {
      await this.api.get(`${this.baseEndpoint}/health`);
      return true;
    } catch {
      return false;
    }
  }

  // Obtener productos de todos los surtidores
  async getProductsFromAllPumps() {
    return this.api.get(`${this.baseEndpoint}/products`);
  }

  // Obtener productos de un surtidor específico
  async getProductsFromPump(pumpId: number) {
      return this.api.get(`${this.baseEndpoint}/${pumpId}/products`);
  }
}

const pumpService = new PumpService();
export default pumpService;