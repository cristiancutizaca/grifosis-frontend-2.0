// src/credits/dto/create-credit.dto.ts
import { IsInt, IsOptional, IsIn, Min, IsNumber, IsDateString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateCreditDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  client_id!: number;

  // En tu front es opcional; en DB suele ser nullable
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sale_id?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Transform(({ value }) => Number(Number(value).toFixed(2)))
  credit_amount!: number;

  // Por defecto 0 si no se envía
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) =>
    value === undefined || value === null ? 0 : Number(Number(value).toFixed(2))
  )
  amount_paid?: number;

  // Acepta ISO 8601: "2025-09-23T05:00:00.000Z"
  @IsDateString()
  due_date!: string;

  // Normalmente lo calculamos en el service, pero lo permitimos si viene
  @IsOptional()
  @IsIn(['pending', 'paid', 'overdue'])
  status?: 'pending' | 'paid' | 'overdue';
}
