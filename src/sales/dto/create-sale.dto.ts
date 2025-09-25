import {
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateSaleDto {
  @IsOptional()
  @IsNumber()
  client_id?: number;

  @IsNumber()
  user_id: number;

  @IsOptional()
  @IsNumber()
  employee_id?: number;

  @IsNumber()
  nozzle_id: number;

  // Neto/base (post-descuento). Opcional: el servicio lo recalcula si no viene
  @IsOptional()
  @IsNumber()
  @Min(0)
  total_amount?: number;

  // Descuento en moneda
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  // Total cobrado (con IGV, post-descuento). Opcional: el servicio lo recalcula si no viene
  @IsOptional()
  @IsNumber()
  @Min(0)
  final_amount?: number;

  // 👉 NUEVOS: para que no se eliminen con whitelist
  // Bruto con IGV (pre-descuento) — si viene, se usa como fuente principal
  @IsOptional()
  @IsNumber()
  @Min(0)
  gross_amount?: number;

  // Precio por galón (normalmente CON IGV) — usado para P*G
  @IsOptional()
  @IsNumber()
  @Min(0)
  unit_price?: number;

  // Galones — usado para P*G
  @IsOptional()
  @IsNumber()
  @Min(0)
  volume_gallons?: number;

  // IGV (ej. 0.18)
  @IsOptional()
  @IsNumber()
  @Min(0)
  igv_rate?: number;

  @IsNumber()
  payment_method_id: number;

  // También puede venir por nombre (“credito”, “efectivo”, etc.)
  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  applyDynamicPricing?: boolean;

  // Fecha de vencimiento para ventas a crédito (YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  due_date?: string;
}
