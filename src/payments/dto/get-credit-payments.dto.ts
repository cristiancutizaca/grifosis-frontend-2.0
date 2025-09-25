import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class GetCreditPaymentsDto {
  // Propiedad "page" (no método)
  @IsOptional()
  @Type(() => Number)   // "1" -> 1
  @IsInt()
  @Min(1)
  page: number = 1;

  // Propiedad "pageSize"
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 10;
}
