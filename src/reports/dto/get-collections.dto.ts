// src/reports/dto/get-collections.dto.ts
import { IsOptional, IsString, IsNumberString, IsEnum } from 'class-validator';

export class GetCollectionsDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumberString()
  clientId?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsEnum(['json', 'excel', 'pdf'])
  format?: 'json' | 'excel' | 'pdf';
}
