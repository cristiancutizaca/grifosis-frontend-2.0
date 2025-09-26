import ApiService from './apiService';
import { SurtidoresTanques } from '../../app/grifo-inventario/types/surtidores-tanques';

class PumpsTanksService {
    private api = ApiService;
    private baseEndpoint = '/pumps-tanks';
    prisma: any;

    // Obtener todos los surtidores y tanques
    async getAllPumpTanks(): Promise<SurtidoresTanques[]> {
        return await this.api.get<SurtidoresTanques[]>(`${this.baseEndpoint}`);
    };

    // Asignar tanques a un surtidor
    async assignTanksToPump(pumpId: number, tankIds: number[]) {
        return this.api.post('/pumps-tanks/assign-tanks', {
            pump_id: pumpId,
            tank_ids: tankIds
        });
    }

    async replaceTanksForPump(pumpId: number, tankIds: number[]) {
        return this.api.put(`/pumps-tanks/pump/${pumpId}/tanks`, {
            tankIds
        });
    }

    async getTanksByPumpId(pumpId: number) {
        return this.api.get(`/pumps-tanks/pump/${pumpId}`);
    }
}

const pumpsTanksService = new PumpsTanksService();
export default pumpsTanksService;