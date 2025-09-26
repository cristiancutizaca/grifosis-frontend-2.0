import apiService from './apiService';
import { Dispensador } from "../../app/grifo-inventario/types/dispensadores";

export interface CreateNozzleDto extends Omit<Dispensador, 'nozzle_id' | 'created_at' | 'updated_at'> {}
export interface UpdateNozzleDto extends Partial<CreateNozzleDto> {
  nozzle_id: number;
}

class NozzleService {
  private endpoint = "/nozzles";

  async getAllNozzles(): Promise<Dispensador[]> {
    const response = await apiService.get<Dispensador[]>(this.endpoint);
    return response;
  }

  async getNozzlesByPump(pumpId: number): Promise<Dispensador[]> {
    const response = await apiService.get<Dispensador[]>(`${this.endpoint}?bomba_id=${pumpId}`);
    return response;
  }

  async getActiveNozzles(): Promise<Dispensador[]> {
    const response = await apiService.get<Dispensador[]>(`${this.endpoint}?estado=activo`);
    return response;
  }

  async getPumps(): Promise<number[]> {
    const response = await apiService.get<number[]>(`${this.endpoint}/pumps`);
    return response;
  }

  async createNozzle(nozzleData: CreateNozzleDto): Promise<Dispensador> {
    const response = await apiService.post<Dispensador>(this.endpoint, nozzleData);
    return response;
  }

  async updateNozzle(nozzleId: number, nozzleData: UpdateNozzleDto): Promise<Dispensador> {
    const response = await apiService.patch<Dispensador>(`${this.endpoint}/${nozzleId}`, nozzleData);
    return response;
  }

  async deleteNozzle(nozzleId: number): Promise<void> {
    await apiService.delete<void>(`${this.endpoint}/${nozzleId}`);
  }
}

const nozzleService = new NozzleService();
export default nozzleService;
