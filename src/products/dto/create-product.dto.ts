import { Type } from 'class-transformer';
import { IsString, IsNumber, IsOptional, IsBoolean, IsPositive } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  fuel_type?: string;

  @IsString()
  unit: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unit_price: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
