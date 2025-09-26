import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('cash-box')
export class CashBoxController {
  constructor(private readonly dataSource: DataSource) {}

  /** Turno por hora (Lima) - se mantiene por compatibilidad con otras vistas */
  private getCurrentShift(now = new Date()): 'Leon' | 'Lobo' | 'Buho' {
    const limaNow = new Date(
      new Date(now).toLocaleString('en-US', { timeZone: 'America/Lima' })
    );
    const minutes = limaNow.getHours() * 60 + limaNow.getMinutes();
    if (minutes >= 5 * 60 && minutes < 12 * 60) return 'Leon';   // 05:00–11:59
    if (minutes >= 12 * 60 && minutes < 19 * 60) return 'Lobo';  // 12:00–18:59
    return 'Buho';                                                // 19:00–04:59
  }

  /** Normaliza nombre de turno y valida (acepta shift_name o shift) */
  private normalizeShift(value?: string): 'Leon' | 'Lobo' | 'Buho' {
    if (!value) return this.getCurrentShift(); // si no llega, asumimos por hora
    const v = String(value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sin acentos
      .trim().toLowerCase();

    if (v.startsWith('leo')) return 'Leon';
    if (v.startsWith('tar') || v.startsWith('lob')) return 'Lobo'; // "lobo"
    if (v.startsWith('buh')) return 'Buho';

    throw new BadRequestException('shift_name debe ser "Leon" | "Lobo" | "Buho"');
  }

  /** YYYY-MM-DD de hoy (Lima) */
  private limaToday(): string {
    return new Date()
      .toLocaleString('sv-SE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .slice(0, 10);
  }
  private normalizeDate(d?: string): string {
    const s = (d || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return this.limaToday();
  }

  /**
   * Abrir caja (GLOBAL por día)
   * Body: { shift_name?: 'Leon'|'Lobo'|'Buho', shift?: alias, opened_by: number, opened_by_name?: string, opening_amount: number }
   * CAMBIO: valida que NO exista ninguna caja ABIERTA hoy (ignora turno).
   */
  @Post('open')
  async open(@Body() body: any) {
    const { shift_name, shift, opened_by, opened_by_name, opening_amount } = body ?? {};
    if (opened_by == null || opening_amount == null) {
      throw new BadRequestException('opened_by y opening_amount son requeridos');
    }

    const shiftNorm = this.normalizeShift(shift_name ?? shift);
    const openedBy = Number(opened_by);
    const openingAmount = Number(opening_amount);
    const openedByName = (opened_by_name ?? null) as string | null;

    // === CAMBIO CLAVE (GLOBAL): ¿ya hay una caja ABIERTA hoy (sin importar turno)?
    const checkSql = `
      SELECT id
        FROM public.cash_box_sessions
       WHERE day_date = (now() AT TIME ZONE 'America/Lima')::date
         AND is_closed = false
       LIMIT 1;
    `;
    const check: any[] = await this.dataSource.query(checkSql);
    if (check?.length) {
      throw new ConflictException('Ya existe una caja abierta hoy');
    }

    // Insertar (turno queda como informativo)
    try {
      const insertSql = `
        INSERT INTO public.cash_box_sessions
          (day_date, shift_name, opened_by, opened_by_name, opening_amount)
        VALUES
          ((now() AT TIME ZONE 'America/Lima')::date, $1, $2, $3, $4)
        RETURNING
          id,
          day_date,
          shift_name,
          opened_at,
          opened_by,
          opened_by_name,
          opening_amount::float8 AS opening_amount,
          closed_at,
          closed_by,
          closed_by_name,
          closing_amount::float8 AS closing_amount,
          sales_amount::float8 AS sales_amount,
          notes,
          is_closed;
      `;
      const rows: any[] = await this.dataSource.query(
        insertSql,
        [shiftNorm, openedBy, openedByName, openingAmount] as any,
      );
      return rows?.[0] ?? null;
    } catch (e: any) {
      if (String(e?.code) === '23505') {
        // por si tienes el índice único parcial en BD
        throw new ConflictException('Ya existe una caja abierta hoy');
      }
      throw e;
    }
  }

  /**
   * Cerrar caja (por id) - se mantiene como lo tienes
   * Body: { id: number, closed_by: number, closed_by_name?: string, closing_amount: number, sales_amount?: number, notes?: string }
   */
  @Post('close')
  async close(@Body() body: any) {
    const { id, closed_by, closed_by_name, closing_amount, sales_amount, notes } = body ?? {};
    if (id == null || closed_by == null || closing_amount == null) {
      throw new BadRequestException('id, closed_by y closing_amount son requeridos');
    }

    const _id = Number(id);
    const closedBy = Number(closed_by);
    const closingAmount = Number(closing_amount);
    const salesAmount = sales_amount == null ? 0 : Number(sales_amount);
    const closedByName = (closed_by_name ?? null) as string | null;

    // Verificamos si existe y si ya está cerrada
    const prevSql = `SELECT is_closed FROM public.cash_box_sessions WHERE id = $1 LIMIT 1;`;
    const prev: any[] = await this.dataSource.query(prevSql, [_id]);
    if (!prev?.length) throw new NotFoundException('Sesión no encontrada');
    if (prev[0]?.is_closed === true) {
      throw new ConflictException('La sesión ya está cerrada');
    }

    // Cerramos
    const sql = `
      UPDATE public.cash_box_sessions
         SET closed_at = now(),
             closed_by = $2,
             closed_by_name = $3,
             closing_amount = $4,
             sales_amount = $5,
             notes = $6,
             is_closed = TRUE
       WHERE id = $1 AND is_closed = FALSE
       RETURNING
          id,
          day_date,
          shift_name,
          opened_at,
          opened_by,
          opened_by_name,
          opening_amount::float8 AS opening_amount,
          closed_at,
          closed_by,
          closed_by_name,
          closing_amount::float8 AS closing_amount,
          sales_amount::float8 AS sales_amount,
          notes,
          is_closed;
    `;
    const rows: any[] = await this.dataSource.query(
      sql,
      [_id, closedBy, closedByName, closingAmount, salesAmount, notes ?? null] as any,
    );
    if (!rows?.length) {
      throw new ConflictException('La sesión ya fue cerrada');
    }
    return rows[0];
  }

  /**
   * Estado de HOY (o fecha dada)
   * CAMBIO: el estado que retorna (abierta/cerrada) es **GLOBAL** por día.
   * - Sin params → lista de sesiones de HOY (array) [SE MANTIENE]
   * - Con cualquier param → devuelve **UN objeto** con estado global de HOY (Lima) **ignorando date/shift**.
   */
  @Get('today')
  async today(
    @Query('date') date?: string,
    @Query('day') day?: string, // alias
    @Query('shift') _shift?: string,
    @Query('shift_name') _shift_name?: string, // alias aceptado (no se usa para el estado)
  ) {
    const hasParams = Boolean(date || day || _shift || _shift_name);

    // Sin parámetros: lista del día actual (como ya hacías)
    if (!hasParams) {
      const sql = `
        SELECT
          id,
          day_date,
          shift_name,
          opened_at,
          opened_by,
          opened_by_name,
          opening_amount::float8 AS opening_amount,
          closed_at,
          closed_by,
          closed_by_name,
          closing_amount::float8 AS closing_amount,
          sales_amount::float8 AS sales_amount,
          notes,
          is_closed
        FROM public.cash_box_sessions
        WHERE day_date = (now() AT TIME ZONE 'America/Lima')::date
        ORDER BY opened_at DESC;
      `;
      const rows: any[] = await this.dataSource.query(sql);
      return rows;
    }

    // 🔧 CAMBIO MINIMO: ignoramos totalmente los parámetros y usamos SIEMPRE "hoy" Lima
    const dayKey = this.limaToday();

    // ¿Hay alguna caja ABIERTA en ese día?
    const openSql = `
      SELECT
        id, day_date, shift_name, opened_at, opened_by, opened_by_name,
        opening_amount::float8 AS opening_amount, is_closed
      FROM public.cash_box_sessions
      WHERE day_date = $1::date AND is_closed = false
      ORDER BY opened_at DESC
      LIMIT 1;
    `;
    const open: any[] = await this.dataSource.query(openSql, [dayKey]);
    if (open?.length) {
      const row = open[0];
      return { status: 'abierta', ...row, is_closed: false };
    }

    // No hay abierta: devolvemos 'cerrada' con montos (incluye opening_amount y closing_amount)
    const lastSql = `
      SELECT
        id, day_date, shift_name, opened_at, closed_at, is_closed,
        opening_amount::float8 AS opening_amount,
        closing_amount::float8 AS closing_amount,
        sales_amount::float8   AS sales_amount,
        opened_by, opened_by_name, closed_by, closed_by_name
      FROM public.cash_box_sessions
      WHERE day_date = $1::date
      ORDER BY opened_at DESC
      LIMIT 1;
    `;
    const last: any[] = await this.dataSource.query(lastSql, [dayKey]);
    const row = last?.[0];
    return {
      status: 'cerrada',
      id: row?.id ?? null,
      day_date: dayKey,
      shift_name: row?.shift_name ?? null,
      opened_at: row?.opened_at ?? null,
      closed_at: row?.closed_at ?? null,
      is_closed: true,
      opening_amount: row?.opening_amount ?? 0,
      closing_amount: row?.closing_amount ?? null,
      sales_amount: row?.sales_amount ?? null,
      opened_by: row?.opened_by ?? null,
      opened_by_name: row?.opened_by_name ?? null,
      closed_by: row?.closed_by ?? null,
      closed_by_name: row?.closed_by_name ?? null,
    };
  }

  /**
   * Historial de un día (se mantiene igual)
   * Ej: /cash-box/history?day=2025-08-25
   */
  @Get('history')
  async history(@Query('day') day?: string) {
    const d = this.normalizeDate(day);

    const sqlDay = `
      SELECT
        shift_name,
        opened_at,
        opened_by,
        opened_by_name,
        opening_amount::float8 AS opening_amount,
        closed_at,
        closed_by,
        closed_by_name,
        closing_amount::float8 AS closing_amount,
        notes,
        is_closed
      FROM public.cash_box_sessions
      WHERE day_date = $1::date
      ORDER BY opened_at ASC, closed_at ASC NULLS LAST;
    `;
    const dayRows: any[] = await this.dataSource.query(sqlDay, [d]);

    const sqlLateCloses = `
      SELECT
        shift_name,
        opened_at,
        opened_by,
        opened_by_name,
        opening_amount::float8 AS opening_amount,
        closed_at,
        closed_by,
        closed_by_name,
        closing_amount::float8 AS closing_amount,
        notes,
        is_closed
      FROM public.cash_box_sessions
      WHERE closed_at IS NOT NULL
        AND ((closed_at AT TIME ZONE 'America/Lima')::date = $1::date)
        AND day_date <> $1::date
      ORDER BY closed_at ASC;
    `;
    const lateRows: any[] = await this.dataSource.query(sqlLateCloses, [d]);

    const events: any[] = [];
    for (const r of dayRows) {
      if (r.opened_at) {
        events.push({
          type: 'open',
          timestamp: r.opened_at,
          by: r.opened_by_name ?? (r.opened_by != null ? `Usuario ${r.opened_by}` : '—'),
          shift: r.shift_name,
          amount: Number(r.opening_amount ?? 0),
          notes: r.notes ?? undefined,
        });
      }
      if (r.closed_at) {
        events.push({
          type: 'close',
          timestamp: r.closed_at,
          by: r.closed_by_name ?? (r.closed_by != null ? `Usuario ${r.closed_by}` : '—'),
          shift: r.shift_name,
          totalInCash: Number(r.closing_amount ?? 0),
          notes: r.notes ?? undefined,
        });
      }
    }
    for (const r of lateRows) {
      events.push({
        type: 'close',
        timestamp: r.closed_at,
        by: r.closed_by_name ?? (r.closed_by != null ? `Usuario ${r.closed_by}` : '—'),
        shift: r.shift_name,
        totalInCash: Number(r.closing_amount ?? 0),
        notes: r.notes ?? undefined,
      });
    }
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { dateKey: d, events };
  }

  /**
   * Historial (rango opcional) - se mantiene igual
   * /cash-box/list?from=2025-08-20&to=2025-08-25
   */
  @Get('list')
  async list(@Query('from') from?: string, @Query('to') to?: string) {
    if (from || to) {
      const sql = `
        SELECT
          id,
          day_date,
          shift_name,
          opened_at,
          opened_by,
          opened_by_name,
          opening_amount::float8 AS opening_amount,
          closed_at,
          closed_by,
          closed_by_name,
          closing_amount::float8 AS closing_amount,
          sales_amount::float8 AS sales_amount,
          notes,
          is_closed
        FROM public.cash_box_sessions
        WHERE ($1::date IS NULL OR day_date >= $1::date)
          AND ($2::date IS NULL OR day_date <= $2::date)
        ORDER BY day_date DESC, opened_at DESC;
      `;
      const rows: any[] = await this.dataSource.query(sql, [from ?? null, to ?? null]);
      return rows;
    } else {
      const sql = `
        SELECT
          id,
          day_date,
          shift_name,
          opened_at,
          opened_by,
          opened_by_name,
          opening_amount::float8 AS opening_amount,
          closed_at,
          closed_by,
          closed_by_name,
          closing_amount::float8 AS closing_amount,
          sales_amount::float8 AS sales_amount,
          notes,
          is_closed
        FROM public.cash_box_sessions
        ORDER BY day_date DESC, opened_at DESC
        LIMIT 200;
      `;
      const rows: any[] = await this.dataSource.query(sql);
      return rows;
    }
  }
}
