import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsDecimal,
} from 'class-validator';

export class CreateTankDto {
  @IsNotEmpty()
  @IsString()
  tank_name: string;

  @IsNotEmpty()
  @IsInt()
  product_id: number;

  @IsNotEmpty()
  @IsDecimal({ decimal_digits: '0,3' })
  total_capacity: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
