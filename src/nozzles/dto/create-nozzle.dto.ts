import { IsNotEmpty, IsString, IsInt, IsOptional } from 'class-validator';

export class CreateNozzleDto {
  @IsNotEmpty()
  @IsInt()
  nozzle_number: number;

  @IsNotEmpty()
  @IsInt()
  pump_id: number;

  @IsNotEmpty()
  @IsInt()
  product_id: number;

  @IsNotEmpty()
  @IsInt()
  tank_id: number;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  created_at?: string;

  @IsOptional()
  @IsString()
  updated_at?: string;
}