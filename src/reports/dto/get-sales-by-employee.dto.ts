// src/reports/dto/get-sales-by-employee.dto.ts
import { IsOptional, IsString, IsNumberString, IsEnum } from 'class-validator';

export class GetSalesByEmployeeDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['json', 'excel', 'pdf'])
  format?: 'json' | 'excel' | 'pdf';
}
