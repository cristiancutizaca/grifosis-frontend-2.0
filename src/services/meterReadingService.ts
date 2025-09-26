import { CreateMeterReading, UpdateMeterReading, MeterReading, ShiftReading } from '../../app/grifo-turnos/types/meter-reading';
import apiService from './apiService';

class MeterReadingService {
    private endpoint = "/meter-readings";

    async create(data: CreateMeterReading): Promise<MeterReading> {
        console.log('🔍 Creando meter reading con datos:', data);
        try {
            const result = await apiService.post<MeterReading>(this.endpoint, data);
            console.log('✅ Meter reading creado exitosamente:', result);
            return result;
        } catch (error) {
            console.error('❌ Error al crear meter reading:', error);
            throw error;
        }
    }

    /*async findAll(): Promise<MeterReading[]> {
        return await apiService.get<MeterReading[]>(this.endpoint);
    }*/

    async getShiftReadings(date?: string): Promise<ShiftReading[]> {
        const url = date ? `${this.endpoint}/shift-readings?date=${date}` : `${this.endpoint}/shift-readings`;
        return await apiService.get<ShiftReading[]>(url);
    }

    async getLastReadings(): Promise<MeterReading[]> {
        return await apiService.get<MeterReading[]>(`${this.endpoint}/last-readings`)
    }

    /*async findOne(id: number): Promise<MeterReading> {
        return await apiService.get<MeterReading>(`${this.endpoint}/${id}`);
    }*/

    async update(id: number, data: UpdateMeterReading): Promise<MeterReading> {
        console.log('🔍 Actualizando meter reading ID:', id, 'con datos:', data);
        try {
            const result = await apiService.patch<MeterReading>(`${this.endpoint}/${id}`, data);
            console.log('✅ Meter reading actualizado exitosamente:', result);
            return result;
        } catch (error) {
            console.error('❌ Error al actualizar meter reading:', error);
            throw error;
        }
    }

    /*async remove(id: number): Promise<void> {
        await apiService.delete<void>(`${this.endpoint}/${id}`);
    }*/
}

export default new MeterReadingService();
