import { IsNumber, IsOptional, IsString, IsDecimal, IsIn } from 'class-validator';

export class CreateDeliveryDto {
  @IsNumber()
  supplier_id: number;

  @IsOptional()
  @IsNumber()
  employee_id?: number;

  @IsOptional()
  @IsString()
  delivery_date?: string;

  @IsDecimal()
  total_amount: number;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'received', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
