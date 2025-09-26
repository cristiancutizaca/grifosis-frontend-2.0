import { IsIn, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ClientReportParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId!: number;

  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  group?: 'day' | 'week' | 'month' = 'day';
}
