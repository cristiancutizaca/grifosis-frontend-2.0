import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  ListLimitsQueryDto,
  PatchActiveDto,
  PeriodKind,
  UpsertClientProductLimitDto,
} from './dto/upsert-limit.dto';

type DbRow = {
  id: number;
  client_id: number;
  product_id: number;
  period_kind: PeriodKind;
  max_gallons: string;              // numeric en PG → string
  apply_to_all_payments: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class LimitsService {
  constructor(private readonly ds: DataSource) {}

  /** Garantiza el índice único PARCIAL (único activo por cliente+producto+período) */
  private async ensureActiveUniqueIndex(qr?: QueryRunner) {
    const exec = (sql: string) => (qr ? qr.query(sql) : this.ds.query(sql));
    // Nunca uses DROP CONSTRAINT aquí; es un ÍNDICE.
    await exec(`DROP INDEX IF EXISTS uq_client_product_period_active;`);
    await exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_client_product_period_active
      ON public.client_product_gallon_limits (client_id, product_id, period_kind)
      WHERE is_active = TRUE;
    `);
  }

  /** Normaliza fila DB → objeto API */
  private mapRow(r: DbRow) {
    return {
      id: r.id,
      clientId: r.client_id,
      productId: r.product_id,
      periodKind: r.period_kind,
      maxGallons: Number(r.max_gallons),
      applyToAllPayments: r.apply_to_all_payments,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  /** Crear/actualizar límite de un producto (por período) */
  async upsertLimit(
    clientId: number,
    productId: number,
    dto: UpsertClientProductLimitDto,
  ) {
    const { periodKind, maxGallons, applyToAllPayments = false, isActive = true } = dto;

    if (!['day', 'week', 'month'].includes(periodKind)) {
      throw new BadRequestException('periodKind inválido');
    }
    if (maxGallons == null || Number(maxGallons) <= 0) {
      throw new BadRequestException('maxGallons debe ser > 0');
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await this.ensureActiveUniqueIndex(qr);

      // UPSERT sin requerir constraint único total: update-then-insert (idempotente)
      const updated: DbRow[] = await qr.query(
        `
        WITH upd AS (
          UPDATE public.client_product_gallon_limits
          SET max_gallons = $4::numeric,
              apply_to_all_payments = $5::boolean,
              is_active = $6::boolean,
              updated_at = NOW()
          WHERE client_id = $1 AND product_id = $2 AND period_kind = $3
          RETURNING *
        )
        INSERT INTO public.client_product_gallon_limits
          (client_id, product_id, period_kind, max_gallons, apply_to_all_payments, is_active, created_at, updated_at)
        SELECT $1, $2, $3, $4::numeric, $5::boolean, $6::boolean, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM upd)
        RETURNING *;
        `,
        [clientId, productId, periodKind, maxGallons, applyToAllPayments, isActive],
      );

      // Si INSERT no corrió, lee lo que actualizamos en CTE upd
      const row: DbRow =
        updated[0] ??
        (
          await qr.query(
            `SELECT * FROM public.client_product_gallon_limits
             WHERE client_id=$1 AND product_id=$2 AND period_kind=$3`,
            [clientId, productId, periodKind],
          )
        )[0];

      await qr.commitTransaction();
      return this.mapRow(row);
    } catch (err) {
      await qr.rollbackTransaction();
      // Re-lanzar como 400 si viola el índice parcial (duplicado activo)
      if (String(err?.message || '').includes('uq_client_product_period_active')) {
        throw new BadRequestException(
          'Ya existe un límite ACTIVO para este cliente, producto y período.',
        );
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * Activar / desactivar límites.
   * - Si viene `periodKind` en el dto o query, afecta SOLO ese período.
   * - Si no viene, afecta TODOS los períodos del producto para ese cliente.
   */
  async patchActive(
    clientId: number,
    productId: number,
    dto: PatchActiveDto & { periodKind?: PeriodKind | null },
  ) {
    const { isActive, periodKind = null } = dto;

    if (typeof isActive !== 'boolean') {
      throw new BadRequestException('isActive es requerido (boolean)');
    }
    if (periodKind && !['day', 'week', 'month'].includes(periodKind)) {
      throw new BadRequestException('periodKind inválido');
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await this.ensureActiveUniqueIndex(qr);

      const params: any[] = [clientId, productId, isActive];
      let sql = `
        UPDATE public.client_product_gallon_limits
        SET is_active = $3::boolean, updated_at = NOW()
        WHERE client_id = $1 AND product_id = $2
      `;
      if (periodKind) {
        sql += ` AND period_kind = $4`;
        params.push(periodKind);
      }

      const res = await qr.query(sql + ' RETURNING *;', params);
      await qr.commitTransaction();

      if (!res.length) {
        throw new NotFoundException('No se encontraron límites para actualizar');
      }

      return res.map((r: DbRow) => this.mapRow(r));
    } catch (err) {
      await qr.rollbackTransaction();
      if (String(err?.message || '').includes('uq_client_product_period_active')) {
        throw new BadRequestException(
          'Ya existe otro límite ACTIVO para ese período. Desactívalo primero o usa otro período.',
        );
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  /** Listado de límites por cliente con filtros opcionales */
  async list(clientId: number, query: ListLimitsQueryDto) {
    const { productId, periodKind, onlyActive } = query as {
      productId?: number;
      periodKind?: PeriodKind;
      onlyActive?: boolean;
    };

    const params: any[] = [clientId];
    let where = 'WHERE c.client_id = $1';

    if (productId) {
      params.push(productId);
      where += ` AND c.product_id = $${params.length}`;
    }
    if (periodKind) {
      if (!['day', 'week', 'month'].includes(periodKind)) {
        throw new BadRequestException('periodKind inválido');
      }
      params.push(periodKind);
      where += ` AND c.period_kind = $${params.length}`;
    }
    if (onlyActive) {
      where += ` AND c.is_active = TRUE`;
    }

    const rows: DbRow[] = await this.ds.query(
      `
      SELECT c.*
      FROM public.client_product_gallon_limits c
      ${where}
      ORDER BY c.product_id, c.period_kind;
    `,
      params,
    );

    return rows.map((r) => this.mapRow(r));
  }
}
