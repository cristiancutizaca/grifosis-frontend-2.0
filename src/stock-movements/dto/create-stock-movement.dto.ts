import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsDecimal,
  Min,
  IsDateString,
} from 'class-validator';
import { MovementType } from '../constants/stock-movement.constants';

export class CreateStockMovementDto {
  @IsNotEmpty()
  @IsNumber()
  product_id: number;

  @IsOptional()
  @IsNumber()
  tank_id?: number;

  @IsOptional()
  @IsNumber()
  user_id?: number;

  @IsNotEmpty()
  @IsDateString()
  movement_timestamp: Date;

  @IsNotEmpty()
  @IsEnum(MovementType)
  movement_type: MovementType;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'quantity must be a number with up to 3 decimal places' })
  @Min(0, { message: 'quantity must not be less than 0' })
  quantity: number;

  @IsOptional()
  @IsNumber()
  sale_detail_id?: number;

  @IsOptional()
  @IsNumber()
  delivery_detail_id?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
