import { IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class OpenCashBoxDto {
  @IsDateString()
  day_date!: string; // 'YYYY-MM-DD' (día de operación del turno)

  @IsIn(['Leon', 'Lobo', 'Buho'])
  shift_name!: 'Leon' | 'Lobo' | 'Buho';

  @IsNumber()
  @Min(0)
  opening_amount!: number;

  @IsOptional()
  @IsInt()
  opened_by?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  opened_by_name?: string;
}

export class CloseCashBoxDto {
  @IsInt()
  id!: number; // id de la sesión abierta

  @IsNumber()
  @Min(0)
  closing_amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  closed_by?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  closed_by_name?: string;
}
