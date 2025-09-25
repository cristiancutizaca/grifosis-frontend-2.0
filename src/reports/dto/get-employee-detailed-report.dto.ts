// src/reports/dto/get-employee-detailed-report.dto.ts
import { IsOptional, IsString, IsNumberString, IsEnum } from 'class-validator';

export class GetEmployeeDetailedReportDto {
  @IsOptional()
  @IsNumberString()
  employeeId?: string;

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

