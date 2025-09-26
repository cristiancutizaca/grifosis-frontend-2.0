import { PartialType } from '@nestjs/mapped-types';
import { CreateMeterReadingDto } from './create-meter-reading.dto';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class UpdateMeterReadingDto extends PartialType(CreateMeterReadingDto) {
    @IsOptional()
    @IsNumber({}, { message: 'La lectura inicial debe ser un número' })
    @IsPositive({ message: 'La lectura inicial debe ser un número positivo' })
    initial_reading?: number;

    @IsOptional()
    @IsNumber({}, { message: 'La lectura final debe ser un número' })
    @IsPositive({ message: 'La lectura final debe ser un número positivo' })
    final_reading?: number;
}
