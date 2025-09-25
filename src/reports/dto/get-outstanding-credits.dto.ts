// src/reports/dto/get-outstanding-credits.dto.ts
import { IsOptional, IsString, IsNumberString, IsEnum } from 'class-validator';

export class GetOutstandingCreditsDto {
  @IsOptional()
  @IsNumberString()
  clientId?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  dueDateStart?: string;

  @IsOptional()
  @IsString()
  dueDateEnd?: string;

  @IsOptional()
  @IsEnum(['json', 'excel', 'pdf'])
  format?: 'json' | 'excel' | 'pdf';
}
