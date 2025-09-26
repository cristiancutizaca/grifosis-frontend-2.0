import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';

function parseISO(s: string, label: string): Date {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new BadRequestException(`Parámetro ${label} inválido`);
  return d;
}

@Injectable()
export class ShiftsReportsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ======================================================================
  // =                            JSON: GLOBAL                            =
  // ======================================================================

  /**
   * Resumen por turno (global) entre from..to
   * Devuelve: shift_name, orders, gallons, revenue, discount_total, tax_total
   */
  async summary(fromISO: string, toISO: string) {
    const from = parseISO(fromISO, 'from');
    const to = parseISO(toISO, 'to');

    const sql = `
      WITH base AS (
        SELECT
          s.sale_id,
          COALESCE(NULLIF(TRIM(s.shift), ''), 'Sin turno') AS shift_name,
          COALESCE(s.final_amount, s.total_amount, 0)      AS sale_amount
        FROM public.sales s
        WHERE s.sale_timestamp >= $1
          AND s.sale_timestamp <  $2
          AND s.status IN ('completed','paid','finalized')
      ),
      gals AS (
        SELECT s.sale_id, SUM(sd.quantity) AS gallons
        FROM public.sale_details sd
        JOIN public.sales s ON s.sale_id = sd.sale_id
        WHERE s.sale_timestamp >= $1
          AND s.sale_timestamp <  $2
          AND s.status IN ('completed','paid','finalized')
        GROUP BY s.sale_id
      ),
      dt AS (
        SELECT s.sale_id,
               SUM(COALESCE(sd.discount_amount,0)) AS discount_total,
               SUM(COALESCE(sd.tax_amount,0))      AS tax_total
        FROM public.sale_details sd
        JOIN public.sales s ON s.sale_id = sd.sale_id
        WHERE s.sale_timestamp >= $1
          AND s.sale_timestamp <  $2
          AND s.status IN ('completed','paid','finalized')
        GROUP BY s.sale_id
      )
      SELECT
        b.shift_name,
        COUNT(*)                                AS orders,
        COALESCE(SUM(g.gallons), 0)             AS gallons,
        SUM(b.sale_amount)                      AS revenue,
        COALESCE(SUM(d.discount_total), 0)      AS discount_total,
        COALESCE(SUM(d.tax_total), 0)           AS tax_total
      FROM base b
      LEFT JOIN gals g ON g.sale_id = b.sale_id
      LEFT JOIN dt   d ON d.sale_id = b.sale_id
      GROUP BY b.shift_name
      ORDER BY b.shift_name ASC;
    `;
    const rows = await this.db.query(sql, [from, to]);
    return rows.map((r: any) => ({
      shift_name: r.shift_name ?? 'Sin turno',
      orders: Number(r.orders ?? 0),
      gallons: Number(r.gallons ?? 0),
      revenue: Number(r.revenue ?? 0),
      discount_total: Number(r.discount_total ?? 0),
      tax_total: Number(r.tax_total ?? 0),
    }));
  }

  /**
   * Detalle por turno (global): productos/ventas dentro de from..to, opcionalmente filtrando por nombre de turno
   */
  async detail(fromISO: string, toISO: string, shift?: string) {
    const from = parseISO(fromISO, 'from');
    const to = parseISO(toISO, 'to');
    const norm = (shift ?? '').trim();

    const params: any[] = [from, to];
    let whereShift = '';
    if (norm) {
      params.push(norm);
      // Comparación por texto de turno (tal como lo guardas en sales.shift)
      whereShift = `AND COALESCE(NULLIF(TRIM(s.shift), ''), 'Sin turno') ILIKE $3`;
    }

    const sql = `
      SELECT
        s.sale_id,
        s.sale_timestamp,
        COALESCE(NULLIF(TRIM(s.shift), ''), 'Sin turno')     AS shift_name,
        p.name                                               AS product_name,
        sd.quantity                                          AS gallons,
        COALESCE(sd.unit_price_at_sale, sd.unit_price, 0)    AS unit_price,
        COALESCE(sd.discount_amount, 0)                      AS discount_amount,
        COALESCE(sd.tax_rate, 0)                             AS tax_rate,
        COALESCE(sd.tax_amount, 0)                           AS tax_amount,
        COALESCE(sd.subtotal, sd.quantity * COALESCE(sd.unit_price_at_sale, sd.unit_price, 0) - COALESCE(sd.discount_amount,0)) AS subtotal,
        pm.name                                              AS payment_method,
        COALESCE(
          NULLIF(TRIM(CONCAT(c.first_name,' ',c.last_name)),''),
          c.company_name,
          c.document_number::text,
          'Venta'
        )                                                    AS client_label
      FROM public.sale_details sd
      JOIN public.sales s               ON s.sale_id = sd.sale_id
      JOIN public.products p            ON p.product_id = sd.product_id
      LEFT JOIN public.payment_methods pm ON pm.payment_method_id = s.payment_method_id
      LEFT JOIN public.clients c        ON c.client_id = s.client_id
      WHERE s.sale_timestamp >= $1 AND s.sale_timestamp < $2
        AND s.status IN ('completed','paid','finalized')
        ${whereShift}
      ORDER BY s.sale_timestamp ASC, s.sale_id, sd.product_id;
    `;
    const rows = await this.db.query(sql, params);
    return rows.map((r: any) => {
      const subtotal = Number(r.subtotal ?? 0);
      const tax = Number(r.tax_amount ?? 0);
      return {
        sale_id: Number(r.sale_id),
        sale_timestamp: r.sale_timestamp,
        shift_name: r.shift_name ?? 'Sin turno',
        product_name: r.product_name,
        gallons: Number(r.gallons ?? 0),
        unit_price: Number(r.unit_price ?? 0),
        discount_amount: Number(r.discount_amount ?? 0),
        tax_rate: Number(r.tax_rate ?? 0),
        tax_amount: tax,
        subtotal,
        total: subtotal + tax,
        payment_method: r.payment_method ?? '',
        client_label: r.client_label ?? 'Venta',
      };
    });
  }

  // ======================================================================
  // =                         JSON: SOLO MI USUARIO                       =
  // ======================================================================

  /**
   * Resumen por turno PER-USER
   */
  async mySummary(fromISO: string, toISO: string, userId: number) {
    const from = parseISO(fromISO, 'from');
    const to = parseISO(toISO, 'to');

    const sql = `
      WITH base AS (
        SELECT
          s.sale_id,
          COALESCE(NULLIF(TRIM(s.shift), ''), 'Sin turno') AS shift_name,
          COALESCE(s.final_amount, s.total_amount, 0)      AS sale_amount
        FROM public.sales s
        WHERE s.sale_timestamp >= $1
          AND s.sale_timestamp <  $2
          AND s.status IN ('completed','paid','finalized')
          AND s.user_id = $3
      ),
      gals AS (
        SELECT s.sale_id, SUM(sd.quantity) AS gallons
        FROM public.sale_details sd
        JOIN public.sales s ON s.sale_id = sd.sale_id
        WHERE s.sale_timestamp >= $1
          AND s.sale_timestamp <  $2
          AND s.status IN ('completed','paid','finalized')
          AND s.user_id = $3
        GROUP BY s.sale_id
      ),
      dt AS (
        SELECT s.sale_id,
               SUM(COALESCE(sd.discount_amount,0)) AS discount_total,
               SUM(COALESCE(sd.tax_amount,0))      AS tax_total
        FROM public.sale_details sd
        JOIN public.sales s ON s.sale_id = sd.sale_id
        WHERE s.sale_timestamp >= $1
          AND s.sale_timestamp <  $2
          AND s.status IN ('completed','paid','finalized')
          AND s.user_id = $3
        GROUP BY s.sale_id
      )
      SELECT
        b.shift_name,
        COUNT(*)                                AS orders,
        COALESCE(SUM(g.gallons), 0)             AS gallons,
        SUM(b.sale_amount)                      AS revenue,
        COALESCE(SUM(d.discount_total), 0)      AS discount_total,
        COALESCE(SUM(d.tax_total), 0)           AS tax_total
      FROM base b
      LEFT JOIN gals g ON g.sale_id = b.sale_id
      LEFT JOIN dt   d ON d.sale_id = b.sale_id
      GROUP BY b.shift_name
      ORDER BY b.shift_name ASC;
    `;
    const rows = await this.db.query(sql, [from, to, userId]);
    return rows.map((r: any) => ({
      shift_name: r.shift_name ?? 'Sin turno',
      orders: Number(r.orders ?? 0),
      gallons: Number(r.gallons ?? 0),
      revenue: Number(r.revenue ?? 0),
      discount_total: Number(r.discount_total ?? 0),
      tax_total: Number(r.tax_total ?? 0),
    }));
  }

  /**
   * Detalle por turno PER-USER
   */
  async myDetail(fromISO: string, toISO: string, userId: number, shift?: string) {
    const from = parseISO(fromISO, 'from');
    const to = parseISO(toISO, 'to');
    const norm = (shift ?? '').trim();

    const params: any[] = [from, to, userId];
    let whereShift = '';
    if (norm) {
      params.push(norm);
      whereShift = `AND COALESCE(NULLIF(TRIM(s.shift), ''), 'Sin turno') ILIKE $4`;
    }

    const sql = `
      SELECT
        s.sale_id,
        s.sale_timestamp,
        COALESCE(NULLIF(TRIM(s.shift), ''), 'Sin turno')     AS shift_name,
        p.name                                               AS product_name,
        sd.quantity                                          AS gallons,
        COALESCE(sd.unit_price_at_sale, sd.unit_price, 0)    AS unit_price,
        COALESCE(sd.discount_amount, 0)                      AS discount_amount,
        COALESCE(sd.tax_rate, 0)                             AS tax_rate,
        COALESCE(sd.tax_amount, 0)                           AS tax_amount,
        COALESCE(sd.subtotal, sd.quantity * COALESCE(sd.unit_price_at_sale, sd.unit_price, 0) - COALESCE(sd.discount_amount,0)) AS subtotal,
        pm.name                                              AS payment_method,
        COALESCE(
          NULLIF(TRIM(CONCAT(c.first_name,' ',c.last_name)),''),
          c.company_name,
          c.document_number::text,
          'Venta'
        )                                                    AS client_label
      FROM public.sale_details sd
      JOIN public.sales s               ON s.sale_id = sd.sale_id
      JOIN public.products p            ON p.product_id = sd.product_id
      LEFT JOIN public.payment_methods pm ON pm.payment_method_id = s.payment_method_id
      LEFT JOIN public.clients c        ON c.client_id = s.client_id
      WHERE s.sale_timestamp >= $1 AND s.sale_timestamp < $2
        AND s.status IN ('completed','paid','finalized')
        AND s.user_id = $3
        ${whereShift}
      ORDER BY s.sale_timestamp ASC, s.sale_id, sd.product_id;
    `;
    const rows = await this.db.query(sql, params);
    return rows.map((r: any) => {
      const subtotal = Number(r.subtotal ?? 0);
      const tax = Number(r.tax_amount ?? 0);
      return {
        sale_id: Number(r.sale_id),
        sale_timestamp: r.sale_timestamp,
        shift_name: r.shift_name ?? 'Sin turno',
        product_name: r.product_name,
        gallons: Number(r.gallons ?? 0),
        unit_price: Number(r.unit_price ?? 0),
        discount_amount: Number(r.discount_amount ?? 0),
        tax_rate: Number(r.tax_rate ?? 0),
        tax_amount: tax,
        subtotal,
        total: subtotal + tax,
        payment_method: r.payment_method ?? '',
        client_label: r.client_label ?? 'Venta',
      };
    });
  }

  // ======================================================================
  // =                               EXCEL                                 =
  // ======================================================================

  private excelBrand = {
    PRIMARY: '1E3A8A',
    PRIMARY_LIGHT: '3B82F6',
    WHITE: 'FFFFFF',
    GRAY_BG: 'F3F4F6',
  };

  private addExcelBrandHeader(
    ws: ExcelJS.Worksheet,
    title: string,
    subtitle: string,
    colCount: number,
  ) {
    const { PRIMARY, WHITE } = this.excelBrand;
    const endCol = String.fromCharCode(64 + colCount);

    ws.mergeCells(`A1:${endCol}1`);
    ws.getCell('A1').value = title;
    ws.getCell('A1').font = { bold: true, size: 18, color: { argb: WHITE } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
    ws.getRow(1).height = 28;

    ws.mergeCells(`A2:${endCol}2`);
    ws.getCell('A2').value = subtitle;
    ws.getCell('A2').font = { size: 11 };
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;

    ws.getRow(3).height = 6;
  }

  private styleExcelTable(ws: ExcelJS.Worksheet, headerRowIndex: number, colCount: number) {
    const { PRIMARY_LIGHT, GRAY_BG, WHITE } = this.excelBrand;

    // Header
    for (let c = 1; c <= colCount; c++) {
      const cell = ws.getRow(headerRowIndex).getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_LIGHT } };
      cell.font = { bold: true, color: { argb: WHITE } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'CCCCCC' } },
        left: { style: 'thin', color: { argb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
        right: { style: 'thin', color: { argb: 'CCCCCC' } },
      };
    }
    ws.getRow(headerRowIndex).height = 20;

    // Rows zebra + borders
    const dataStart = headerRowIndex + 1;
    const lastRow = ws.lastRow?.number ?? dataStart - 1;
    for (let r = dataStart; r <= lastRow; r++) {
      if ((r - dataStart) % 2 === 0) {
        for (let c = 1; c <= colCount; c++) {
          ws.getRow(r).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } };
        }
      }
      for (let c = 1; c <= colCount; c++) {
        const cell = ws.getRow(r).getCell(c);
        cell.border = {
          top: { style: 'hair', color: { argb: 'DDDDDD' } },
          left: { style: 'hair', color: { argb: 'DDDDDD' } },
          bottom: { style: 'hair', color: { argb: 'DDDDDD' } },
          right: { style: 'hair', color: { argb: 'DDDDDD' } },
        };
      }
    }

    // Auto width
    for (let c = 1; c <= colCount; c++) {
      let max = 10;
      for (let r = headerRowIndex; r <= (ws.lastRow?.number ?? headerRowIndex); r++) {
        const v = ws.getRow(r).getCell(c).value;
        const str = typeof v === 'object' && v && 'richText' in (v as any) ? '' : String((v as any) ?? '');
        max = Math.max(max, str.length);
      }
      ws.getColumn(c).width = Math.min(60, Math.max(12, Math.ceil(max * 1.2)));
    }
  }

  private addExcelTotals(
    ws: ExcelJS.Worksheet,
    headerRowIndex: number,
    labels: { key: string; label: string; fmt?: 'currency' | 'qty' }[],
  ) {
    const startData = headerRowIndex + 1;
    const endData = ws.lastRow?.number ?? startData;
    const sumRow = endData + 2;

    ws.mergeCells(`A${sumRow}:B${sumRow}`);
    ws.getCell(`A${sumRow}`).value = 'Totales';
    ws.getCell(`A${sumRow}`).font = { bold: true };

    const letter = (idx: number) => String.fromCharCode(64 + idx);

    labels.forEach((l, i) => {
      // localizar columna por encabezado (includes)
      let colIdx = 0;
      for (let c = 1; c <= (ws.columns?.length ?? 1); c++) {
        const head = ws.getRow(headerRowIndex).getCell(c).value;
        const key = (typeof head === 'string' ? head : String(head ?? '')).toLowerCase();
        if (key.includes(l.key.toLowerCase())) { colIdx = c; break; }
      }
      if (colIdx > 0) {
        const labelColIdx = 3 + i * 2;
        ws.getCell(sumRow, labelColIdx).value = l.label;
        ws.getCell(sumRow, labelColIdx + 1).value = {
          formula: `SUBTOTAL(9,${letter(colIdx)}${startData}:${letter(colIdx)}${endData})`,
        } as any;
        if (l.fmt === 'currency') ws.getCell(sumRow, labelColIdx + 1).numFmt = '[$S/] #,##0.00';
        if (l.fmt === 'qty') ws.getCell(sumRow, labelColIdx + 1).numFmt = '#,##0.000';
      }
    });
  }

  // ------------------------ Excel builders ------------------------

  async exportShiftSummaryExcel(rows: any[], fromISO: string, toISO: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Turnos');
    const headers = ['Turno', 'Pedidos', 'Galones', 'Total (S/)', 'Descuento (S/)', 'IGV (S/)'];

    this.addExcelBrandHeader(
      ws,
      'Ventas por Turno (resumen)',
      `Período: ${fromISO} a ${toISO} | Generado: ${new Date().toISOString().slice(0,16).replace('T',' ')}`,
      headers.length,
    );

    const HEADER_ROW = 4;
    ws.getRow(HEADER_ROW).values = headers;

    rows.forEach((r: any) => {
      ws.addRow([
        r.shift_name,
        r.orders,
        r.gallons,
        r.revenue,
        r.discount_total,
        r.tax_total,
      ]);
    });

    ws.getColumn(3).numFmt = '#,##0.000';       // galones
    ws.getColumn(4).numFmt = '[$S/] #,##0.00';  // total
    ws.getColumn(5).numFmt = '[$S/] #,##0.00';  // descuento
    ws.getColumn(6).numFmt = '[$S/] #,##0.00';  // igv

    this.styleExcelTable(ws, HEADER_ROW, headers.length);
    this.addExcelTotals(ws, HEADER_ROW, [
      { key: 'Galones',   label: 'Total Galones',   fmt: 'qty' },
      { key: 'Total',     label: 'Total Ventas',    fmt: 'currency' },
      { key: 'Descuento', label: 'Total Descuento', fmt: 'currency' },
      { key: 'IGV',       label: 'Total IGV',       fmt: 'currency' },
    ]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportShiftDetailExcel(rows: any[], fromISO: string, toISO: string, shift?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Detalle Turno');
    const headers = [
      'Fecha/Hora','Turno','Producto','Galones','Precio Unit.','Subtotal','IGV','Total','Pago','Cliente',
    ];

    this.addExcelBrandHeader(
      ws,
      `Detalle de Ventas – Turno ${shift || 'Todos'}`,
      `Período: ${fromISO} a ${toISO} | Generado: ${new Date().toISOString().slice(0,16).replace('T',' ')}`,
      headers.length,
    );

    const HEADER_ROW = 4;
    ws.getRow(HEADER_ROW).values = headers;

    rows.forEach((r: any) => {
      ws.addRow([
        r.sale_timestamp,
        r.shift_name,
        r.product_name,
        r.gallons,
        r.unit_price,
        r.subtotal,
        r.tax_amount,
        r.total,
        r.payment_method,
        r.client_label,
      ]);
    });

    ws.getColumn(1).numFmt = 'yyyy-mm-dd hh:mm';
    ws.getColumn(4).numFmt = '#,##0.000';        // Galones
    [5,6,7,8].forEach(c => ws.getColumn(c).numFmt = '[$S/] #,##0.00'); // Precios/Importes

    this.styleExcelTable(ws, HEADER_ROW, headers.length);
    this.addExcelTotals(ws, HEADER_ROW, [
      { key: 'Galones',  label: 'Total Galones',   fmt: 'qty' },
      { key: 'Subtotal', label: 'Total Subtotal',  fmt: 'currency' },
      { key: 'Total',    label: 'Total Venta',     fmt: 'currency' },
      { key: 'IGV',      label: 'Total IGV',       fmt: 'currency' },
    ]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
