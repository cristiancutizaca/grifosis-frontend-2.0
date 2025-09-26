import { Tanks } from "../../app/grifo-inventario/types/tanques";
import ApiService from "./apiService";

class TanksService {
  private api = ApiService;
  private baseEndpoint = "/tanks";

  async getAllTanks(): Promise<Tanks[]> {
    return await this.api.get<Tanks[]>(`${this.baseEndpoint}`);
  }

  async getTankById(id: number): Promise<Tanks> {
    return await this.api.get<Tanks>(`${this.baseEndpoint}/${id}`);
  }

  async createTank(tankData: any): Promise<Tanks> {
    return await this.api.post<Tanks>(`${this.baseEndpoint}`, tankData);
  }

  async updateTank(id: number, tankData: any): Promise<Tanks> {
    return await this.api.patch<Tanks>(`${this.baseEndpoint}/${id}`, tankData);
  }

  async deleteTank(id: number): Promise<void> {
    await this.api.delete<void>(`${this.baseEndpoint}/${id}`);
  }

  async healthCheckTanks(): Promise<boolean> {
    try {
      await this.api.get(`${this.baseEndpoint}/health`);
      return true;
    } catch {
      return false;
    }
  }
}

const tanksService = new TanksService();
export default tanksService;
