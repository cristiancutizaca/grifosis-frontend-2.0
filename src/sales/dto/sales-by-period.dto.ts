import { IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export type Granularity = 'day'|'week'|'month'|'shift';
export type Format = 'json'|'excel'|'pdf';

export class SalesByPeriodQueryDto {
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;

  @IsOptional() @IsIn(['day','week','month','shift'])
  granularity?: Granularity = 'day';

  @IsOptional() @IsInt() @Type(() => Number) productId?: number;
  @IsOptional() @IsInt() @Type(() => Number) employeeId?: number;
  @IsOptional() @IsInt() @Type(() => Number) clientId?: number;
  @IsOptional() @IsString() paymentMethod?: string; // PaymentMethod.method_name

  @IsOptional() @IsIn(['json','excel','pdf'])
  format?: Format = 'json';
}

