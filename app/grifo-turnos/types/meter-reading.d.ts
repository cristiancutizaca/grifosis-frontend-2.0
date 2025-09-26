import { Dispensador } from "../../grifo-inventario/types/dispensadores";

export interface CreateMeterReading {
    nozzle_id: number;
    initial_reading: number;
    final_reading: number;
    user_id: number | null | undefined;
}

export interface UpdateMeterReading extends Partial<CreateMeterReading> {}

export interface MeterReading extends CreateMeterReading {
    reading_id: number;
    total_dispensed: number | null;
    created_at: Date;
    updated_at: Date;
}

export interface ShiftReading {
    nozzle_id: number;
    firstReading: MeterReading | null;
    lastReading: MeterReading | null;
}
