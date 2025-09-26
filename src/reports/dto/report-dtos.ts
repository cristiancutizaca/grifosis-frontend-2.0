// src/reports/dto/report-dtos.ts
import { IsOptional, IsString, IsEnum, IsNumberString, IsNotEmpty } from 'class-validator';

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

export class GetDetailedEmployeeReportDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

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