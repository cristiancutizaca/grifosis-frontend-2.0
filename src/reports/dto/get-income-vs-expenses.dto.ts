// src/reports/dto/get-income-vs-expenses.dto.ts
import { IsOptional, IsString, IsEnum } from 'class-validator';

export class GetIncomeVsExpensesDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  expenseCategory?: string;

  @IsOptional()
  @IsEnum(['json', 'excel', 'pdf'])
  format?: 'json' | 'excel' | 'pdf';
}
