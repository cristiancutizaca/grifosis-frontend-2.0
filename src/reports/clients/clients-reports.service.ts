import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';

function parseISO(s: string, label: string): Date {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new BadRequestException(`Parámetro ${label} inválido`);
  return d;
}

type GroupKind = 'day' | 'week' | 'month';

@Injectable()
export class ClientsReportsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ==================== JSON (ya existente) ====================
  async detail(clientId: number, fromISO: string, toISO: string) {
    const from = parseISO(fromISO, 'from');
    const to = parseISO(toISO, 'to');
    const sql = `SELECT * FROM public.report_client_sales_detail($1, $2, $3);`;
    return this.db.query(sql, [clientId, from, to]);
  }

  async summary(
    clientId: number,
    fromISO: string,
    toISO: string,
    group: GroupKind = 'day',
  ) {
    const from = parseISO(fromISO, 'from');
    const to = parseISO(toISO, 'to');
    const safeGroup = (group ?? 'day') as GroupKind;

    const sql = `SELECT * FROM public.report_client_sales_summary($1, $2, $3, $4);`;
    return this.db.query(sql, [clientId, from, to, safeGroup]);
  }

  // ==================== Excel: BRAND & HELPERS (mismo diseño) ====================
  /** Paleta tomada de reports normales */
  private excelBrand = {
    PRIMARY: '1E3A8A',
    PRIMARY_LIGHT: '3B82F6',
    WHITE: 'FFFFFF',
    GRAY_BG: 'F3F4F6',
  };

  /** Header corporativo (igual que reports normales) */
  private addExcelBrandHeader(
    ws: ExcelJS.Worksheet,
    title: string,
    subtitle: string,
    colCount: number,
  ) {
    const { PRIMARY, WHITE } = this.excelBrand;
    const endCol = String.fromCharCode(64 + colCount);

    // Título
    ws.mergeCells(`A1:${endCol}1`);
    ws.getCell('A1').value = title;
    ws.getCell('A1').font = { bold: true, size: 18, color: { argb: WHITE } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
    ws.getRow(1).height = 28;

    // Subtítulo
    ws.mergeCells(`A2:${endCol}2`);
    ws.getCell('A2').value = subtitle;
    ws.getCell('A2').font = { bold: false, size: 11 };
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;

    // Espacio
    ws.getRow(3).height = 6;
  }

  /** Estilo de tabla (igual que reports normales) */
  private styleExcelTable(
    ws: ExcelJS.Worksheet,
    headerRowIndex: number,
    colCount: number,
    dataStartRow = headerRowIndex + 1,
  ) {
    const { PRIMARY_LIGHT, GRAY_BG, WHITE } = this.excelBrand;
    const endCol = String.fromCharCode(64 + colCount);

    // Header
    const headerRange = `A${headerRowIndex}:${endCol}${headerRowIndex}`;
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

    // Zebra rows
    const lastRow = ws.lastRow?.number ?? dataStartRow - 1;
    for (let r = dataStartRow; r <= lastRow; r++) {
      if ((r - dataStartRow) % 2 === 0) {
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

    // Auto width aproximado
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

  /** Fila de totales con SUBTOTAL (9 = SUM) igual a reports normales */
  private addExcelTotals(
    ws: ExcelJS.Worksheet,
    headerRowIndex: number,
    labels: { key: string; label: string; fmt?: 'currency' | 'qty' }[],
  ) {
    const startData = headerRowIndex + 1;
    const endData = ws.lastRow?.number ?? startData;
    const sumRow = endData + 2;

    // Título "Totales"
    ws.mergeCells(`A${sumRow}:B${sumRow}`);
    ws.getCell(`A${sumRow}`).value = 'Totales';
    ws.getCell(`A${sumRow}`).font = { bold: true };

    // Utilidad para mapear index->letra
    const letter = (idx: number) => String.fromCharCode(64 + idx);

    labels.forEach((l, i) => {
      // Encontrar columna por encabezado (fila headerRowIndex)
      let colIdx = 0;
      for (let c = 1; c <= (ws.columns?.length ?? 1); c++) {
        const head = ws.getRow(headerRowIndex).getCell(c).value;
        const key = (typeof head === 'string' ? head : String(head ?? '')).toLowerCase();
        // Buscamos por coincidencia del label clave (ej: 'Total', 'Subtotal', 'Impuesto', 'Galones', etc.)
        if (key.includes(l.key.toLowerCase())) {
          colIdx = c; break;
        }
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

  // ==================== Excel builders para CLIENTS ====================

  /** Export DETALLE a Excel (mismo diseño) */
  async exportClientSalesDetailExcel(clientId: number, fromISO: string, toISO: string): Promise<Buffer> {
    const rows = await this.detail(clientId, fromISO, toISO); // array de objetos planos
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ventas (detalle)');

    // Determinar columnas desde los datos, en orden del primer objeto
    const keys = rows.length ? Object.keys(rows[0]) : [];
    // Mapeo de headers amigables (opcional, caen por defecto a key)
    const friendlyHeader: Record<string, string> = {
      date: 'Fecha',
      time: 'Hora',
      sale_timestamp: 'Fecha/Hora',
      sale_id: 'Venta ID',
      client_id: 'Cliente ID',
      client_label: 'Cliente',
      product_id: 'Producto ID',
      product_name: 'Producto',
      gallons: 'Galones',
      unit_price: 'Precio Unit.',
      discount_amount: 'Descuento',
      tax_rate: 'IGV (%)',
      tax_amount: 'IGV (S/.)',
      subtotal: 'Subtotal (S/.)',
      total: 'Total (S/.)',
      payment_method: 'Pago',
      is_credit: 'Crédito',
    };

    // Header de marca
    this.addExcelBrandHeader(
      ws,
      'Ventas por Cliente (detalle)',
      `Cliente ID: ${clientId} | Período: ${fromISO} a ${toISO} | Generado: ${new Date().toISOString().slice(0,16).replace('T',' ')}`,
      Math.max(keys.length, 6),
    );

    // Header fila 4
    const HEADER_ROW = 4;
    ws.getRow(HEADER_ROW).values = keys.length ? keys.map(k => friendlyHeader[k] ?? k) : ['Sin datos'];
    // Datos
    const dataStart = HEADER_ROW + 1;
    rows.forEach(r => {
      const arr = keys.map(k => (r as any)[k]);
      ws.addRow(arr);
    });

    // Tipos comunes
    keys.forEach((k, idx) => {
      const col = ws.getColumn(idx + 1);
      const lower = k.toLowerCase();
      if (/(gallon|cantidad|galones|qty)/.test(lower)) col.numFmt = '#,##0.000';
      if (/(price|amount|subtotal|total|revenue|tax)/.test(lower)) col.numFmt = '[$S/] #,##0.00';
      if (/(date|fecha|timestamp|time)/.test(lower)) col.numFmt = 'yyyy-mm-dd hh:mm';
    });

    // Estilo tabla
    this.styleExcelTable(ws, HEADER_ROW, Math.max(keys.length, 6));

    // Totales típicos
    this.addExcelTotals(ws, HEADER_ROW, [
      { key: 'galon', label: 'Total Galones', fmt: 'qty' },
      { key: 'subtotal', label: 'Total Subtotal', fmt: 'currency' },
      { key: 'total', label: 'Total Venta', fmt: 'currency' },
      { key: 'impuesto', label: 'Total IGV', fmt: 'currency' },
    ]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  /** Export RESUMEN a Excel (mismo diseño) */
  async exportClientSalesSummaryExcel(
    clientId: number,
    fromISO: string,
    toISO: string,
    group: GroupKind = 'day',
  ): Promise<Buffer> {
    const rows = await this.summary(clientId, fromISO, toISO, group);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ventas (resumen)');

    const keys = rows.length ? Object.keys(rows[0]) : [];
    const friendlyHeader: Record<string, string> = {
      period: 'Período',
      sales: 'Nº Ventas',
      gallons: 'Galones',
      revenue: 'Ingresos (S/.)',
      revenue_cash: 'Caja (S/.)',
      revenue_credit: 'Crédito (S/.)',
      discount_total: 'Descuento (S/.)',
      tax_total: 'IGV (S/.)',
    };

    this.addExcelBrandHeader(
      ws,
      'Ventas por Cliente (resumen)',
      `Cliente ID: ${clientId} | Agrupación: ${group} | Período: ${fromISO} a ${toISO} | Generado: ${new Date().toISOString().slice(0,16).replace('T',' ')}`,
      Math.max(keys.length, 5),
    );

    const HEADER_ROW = 4;
    ws.getRow(HEADER_ROW).values = keys.length ? keys.map(k => friendlyHeader[k] ?? k) : ['Sin datos'];

    rows.forEach(r => {
      const arr = keys.map(k => (r as any)[k]);
      ws.addRow(arr);
    });

    keys.forEach((k, idx) => {
      const col = ws.getColumn(idx + 1);
      const lower = k.toLowerCase();
      if (/(gallon|galones|qty)/.test(lower)) col.numFmt = '#,##0.000';
      if (/(revenue|total|amount|discount|tax)/.test(lower)) col.numFmt = '[$S/] #,##0.00';
      if (/(period|fecha|date|timestamp)/.test(lower)) col.numFmt = 'yyyy-mm-dd';
      if (/(sales|conteo|count|n)/.test(lower)) col.numFmt = '#,##0';
    });

    this.styleExcelTable(ws, HEADER_ROW, Math.max(keys.length, 5));

    this.addExcelTotals(ws, HEADER_ROW, [
      { key: 'galo', label: 'Total Galones', fmt: 'qty' },
      { key: 'revenue', label: 'Total Ingresos', fmt: 'currency' },
      { key: 'cash', label: 'Total Caja', fmt: 'currency' },
      { key: 'credit', label: 'Total Crédito', fmt: 'currency' },
      { key: 'descu', label: 'Total Descuento', fmt: 'currency' },
      { key: 'igv', label: 'Total IGV', fmt: 'currency' },
    ]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
