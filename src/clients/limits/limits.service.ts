import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ListLimitsQueryDto,
  PatchActiveDto,
  PeriodKind,
  UpsertClientProductLimitDto,
} from './dto/upsert-limit.dto';

@Injectable()
export class LimitsService {
  constructor(private readonly ds: DataSource) {}

  // =========================================================
  // Listar límites por cliente (filtros: period, active)
  // =========================================================
  async listByClient(clientId: number, query: ListLimitsQueryDto) {
    const params: any[] = [clientId];
    const where: string[] = ['l.client_id = $1'];

    if (query?.period) {
      params.push(query.period);
      where.push(`l.period_kind = $${params.length}`);
    }
    if (query?.active === 'true' || query?.active === 'false') {
      params.push(query.active === 'true');
      where.push(`l.is_active = $${params.length}`);
    }

    const sql = `
      SELECT
        l.id,
        l.client_id,
        l.product_id,
        l.period_kind,
        l.max_gallons,
        l.apply_to_all_payments,
        l.is_active,
        l.created_at,
        p.name AS product_name
      FROM public.client_product_gallon_limits l
      LEFT JOIN public.products p ON p.product_id = l.product_id
      WHERE ${where.join(' AND ')}
      ORDER BY product_name NULLS LAST, l.product_id, l.period_kind;
    `;
    const { rows } = (await this.ds.query(sql, params)) as any;
    return rows;
  }

  // =========================================================
  // Crear/Actualizar con ON CONSTRAINT (resuelve duplicados)
  // =========================================================
  async upsertLimit(
    clientId: number,
    productId: number,
    dto: UpsertClientProductLimitDto,
  ) {
    const {
      periodKind,
      maxGallons,
      applyToAllPayments = true,
      isActive = true,
    } = dto;

    // IMPORTANTE: la BD tiene un UNIQUE parcial llamado "uq_client_product_period_active"
    // (client_id, product_id, period_kind) WHERE is_active = TRUE
    // Usamos ON CONSTRAINT para que haga UPSERT cuando exista un activo.
    const sql = `
      INSERT INTO public.client_product_gallon_limits
        (client_id, product_id, period_kind, max_gallons, apply_to_all_payments, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT ON CONSTRAINT uq_client_product_period_active
      DO UPDATE SET
        max_gallons           = EXCLUDED.max_gallons,
        apply_to_all_payments = EXCLUDED.apply_to_all_payments,
        is_active             = EXCLUDED.is_active  -- permite activar/desactivar en un solo paso
      RETURNING id, client_id, product_id, period_kind, max_gallons,
                apply_to_all_payments, is_active, created_at;
    `;

    const params = [
      clientId,
      productId,
      periodKind,          // 'day' | 'week' | 'month' | 'rolling_30d'
      maxGallons,          // número
      applyToAllPayments,
      isActive,            // si es true y ya hay uno activo -> UPDATE; si es false, también hace UPDATE y lo desactiva
    ];

    const { rows } = (await this.ds.query(sql, params)) as any;
    return rows[0];
  }

  // =========================================================
  // Activar / Desactivar (opcionalmente por período)
  // =========================================================
  async setActive(
    clientId: number,
    productId: number,
    body: PatchActiveDto,
    period?: PeriodKind,
  ) {
    const params: any[] = [clientId, productId, body.isActive];
    const where: string[] = ['client_id = $1', 'product_id = $2'];

    if (period) {
      params.push(period);
      where.push(`period_kind = $${params.length}`);
    }

    const sql = `
      UPDATE public.client_product_gallon_limits
         SET is_active = $3
       WHERE ${where.join(' AND ')}
      RETURNING id, client_id, product_id, period_kind, max_gallons,
                apply_to_all_payments, is_active, created_at;
    `;
    const res = (await this.ds.query(sql, params)) as any;
    return { updated: res.rowCount ?? res.rows?.length ?? 0, rows: res.rows ?? [] };
  }

  // =========================================================
  // Desactivar un período concreto (soft delete)
  // =========================================================
  async deactivateOne(clientId: number, productId: number, period: PeriodKind) {
    const sql = `
      UPDATE public.client_product_gallon_limits
         SET is_active = FALSE
       WHERE client_id = $1 AND product_id = $2 AND period_kind = $3
      RETURNING id, client_id, product_id, period_kind, max_gallons,
                apply_to_all_payments, is_active, created_at;
    `;
    const { rows } = (await this.ds.query(sql, [clientId, productId, period])) as any;
    return { deactivated: rows?.length > 0, row: rows?.[0] };
  }

  // =========================================================
  // Obtener un límite específico
  // =========================================================
  async getOne(clientId: number, productId: number, period: PeriodKind) {
    const sql = `
      SELECT
        l.id,
        l.client_id,
        l.product_id,
        l.period_kind,
        l.max_gallons,
        l.apply_to_all_payments,
        l.is_active,
        l.created_at,
        p.name AS product_name
      FROM public.client_product_gallon_limits l
      LEFT JOIN public.products p ON p.product_id = l.product_id
      WHERE l.client_id = $1 AND l.product_id = $2 AND l.period_kind = $3
      LIMIT 1;
    `;
    const { rows } = (await this.ds.query(sql, [clientId, productId, period])) as any;
    return rows?.[0] ?? null;
  }

  // =========================================================
  // Uso del período (placeholder: used = 0)
  // =========================================================
  async getUsage(clientId: number, productId: number, period: PeriodKind) {
    // Si luego sumas ventas reales, reemplaza el "used = 0"
    const limit = await this.getOne(clientId, productId, period);
    const used = 0;

    const max = limit ? Number(limit.max_gallons) : null;
    const remaining = max != null ? Math.max(0, max - used) : null;

    return {
      client_id: clientId,
      product_id: productId,
      period_kind: period,
      max_gallons: max,
      used_gallons: used,
      remaining_gallons: remaining,
      apply_to_all_payments: limit?.apply_to_all_payments ?? null,
    };
  }
}
