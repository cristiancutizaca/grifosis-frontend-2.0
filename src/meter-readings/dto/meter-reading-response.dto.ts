export class MeterReadingResponseDto {
    reading_id: number;
    nozzle_id: number;
    initial_reading: number;
    final_reading: number;
    total_dispensed: number | null;
    user_id: number | null;
    created_at: Date;
    updated_at: Date | null;
}
