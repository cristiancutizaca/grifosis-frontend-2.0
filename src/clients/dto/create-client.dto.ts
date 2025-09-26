// src/clients/dto/create-client.dto.ts
import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsIn,
  IsDateString,
} from 'class-validator';

export class CreateClientDto {
  @IsOptional()
  @IsIn(['persona', 'empresa']) // Coincide con tu frontend y SQL
  @IsString()
  client_type?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === null ? undefined : value)
  company_name?: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  document_type?: string;

  @IsString()
  document_number: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @Transform(({ value }) => (value === '' ? null : value))
  @IsDateString() // ISO date, ejemplo: "2024-07-11"
  @IsOptional()
  birth_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
