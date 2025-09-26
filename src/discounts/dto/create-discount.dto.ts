import { Type } from 'class-transformer';
import { IsString, IsNumber, Min, Max, IsBoolean, IsOptional } from 'class-validator';

export class CreateDiscountDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  gallons: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsNumber()
  createdBy: number;
}
