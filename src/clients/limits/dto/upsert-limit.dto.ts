import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Expose, Transform, Type } from 'class-transformer';

export enum PeriodKind {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Rolling30d = 'rolling_30d',
}

export class UpsertClientProductLimitDto {
  // acepta periodKind y period_kind
  @Expose({ name: 'periodKind' })
  @Expose({ name: 'period_kind' })
  @IsEnum(PeriodKind)
  periodKind: PeriodKind = PeriodKind.Month;

  // acepta maxGallons y max_gallons; fuerza a número
  @Expose({ name: 'maxGallons' })
  @Expose({ name: 'max_gallons' })
  @Type(() => Number)
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @IsNumber()
  @Min(0.001)
  maxGallons!: number;

  // acepta applyToAllPayments y apply_to_all_payments
  @Expose({ name: 'applyToAllPayments' })
  @Expose({ name: 'apply_to_all_payments' })
  @IsBoolean()
  @IsOptional()
  applyToAllPayments?: boolean = true;

  // acepta isActive y is_active
  @Expose({ name: 'isActive' })
  @Expose({ name: 'is_active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class PatchActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class ListLimitsQueryDto {
  @IsEnum(PeriodKind)
  @IsOptional()
  period?: PeriodKind;

  @IsOptional()
  active?: 'true' | 'false';
}
