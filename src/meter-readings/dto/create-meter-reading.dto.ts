import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class CreateMeterReadingDto {
    @IsNotEmpty()
    @IsNumber()
    nozzle_id: number;

    @IsNotEmpty({ message: 'La lectura inicial es obligatorio' })
    @IsNumber({}, { message: 'La lectura inicial debe ser un número' })
    @IsPositive({ message: 'La lectura inicial debe ser un número positivo' })
    initial_reading: number;

    @IsNotEmpty({ message: 'La lectura final es obligatorio' })
    @IsNumber({}, { message: 'La lectura final debe ser un número' })
    @IsPositive({ message: 'La lectura final debe ser un número positivo' })
    final_reading: number;

    @IsNotEmpty()
    @IsNumber()
    user_id: number;
}
