import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import PdfPrinter = require('pdfmake');
import type { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';

import { Sale } from '../sales/entities/sale.entity';
import { SaleDetail } from '../sale-details/entities/sale-detail.entity';
import { Product } from '../products/entities/product.entity';
import { Client } from '../clients/entities/client.entity';
import { Employee } from '../employees/entities/employee.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { Tank } from '../tanks/entities/tank.entity';
import { StockMovement } from '../stock-movements/entities/stock-movement.entity';
import { Credit } from '../credits/entities/credit.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { SalesByPeriodQueryDto, Granularity } from '../sales/dto/sales-by-period.dto';
import { User } from '../users/entities/user.entity';

// --- Tipos y Constantes (sin cambios) ---
type ColumnDef = { header: string; key: string; currency?: boolean; width?: number };
type DateRange = { startDate: string; endDate: string };
type PaymentKey = 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT' | string;

interface Kpis {
  sales_count: number;
  gross: number;
  net: number;
  avg_ticket: number;
  credits_count: number;
  credits_gross: number;
  recovered_gross: number;
  unique_clients: number;
}
interface PaymentBreakdown {
  key: PaymentKey;
  label: string;
  count: number;
  total_amount: number;
  total_gallons?: number;
}
interface ProductBreakdown {
  product_id: number;
  name: string;
  total_amount: number;
  total_gallons: number;
  count: number;
}
interface CreditBreakdown {
  client_id?: number | null;
  client_name?: string;
  total_amount: number;
  total_gallons?: number;
  count: number;
}
interface TimeseriesPoint {
  date: string;
  gross: number;
  count: number;
}
interface BaseSummary {
  range: DateRange;
  onlyCompleted: boolean;
  kpis: Kpis;
  byPayment: PaymentBreakdown[];
  byProduct: ProductBreakdown[];
  byCreditClient: CreditBreakdown[];
  timeseries: TimeseriesPoint[];
}
interface UserSummary extends BaseSummary {
  user_id: number;
  user_name?: string;
}
interface MultiUserSummary extends BaseSummary {
  user_ids: number[];
}
const AMOUNT_EXPR = `COALESCE(s.final_amount, s.total_amount)`;
const SOLD_STATUS = `('completed','paid','finalized')`;
const normalizePaymentKeySql = `
  UPPER(
    CASE
      WHEN COALESCE(pm.method_name, pm.name, '') ILIKE '%EFECTIV%' THEN 'CASH'
      WHEN COALESCE(pm.method_name, pm.name, '') ILIKE '%TARJET%'  THEN 'CARD'
      WHEN COALESCE(pm.method_name, pm.name, '') ILIKE ANY (ARRAY['%TRANSFER%','%YAPE%','%PLIN%','%DEPOSIT%','%BANCO%']) THEN 'TRANSFER'
      WHEN COALESCE(pm.method_name, pm.name, '') ILIKE '%CRED%'    THEN 'CREDIT'
      ELSE COALESCE(pm.method_name, pm.name, 'OTRO')
    END
  )
`;

@Injectable()
export class ReportsService {
  private readonly tz = 'America/Lima';

  constructor(
    @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleDetail) private readonly saleDetailRepository: Repository<SaleDetail>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Client) private readonly clientRepository: Repository<Client>,
    @InjectRepository(Employee) private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(PaymentMethod) private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Tank) private readonly tankRepository: Repository<Tank>,
    @InjectRepository(StockMovement) private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(Credit) private readonly creditRepository: Repository<Credit>,
    @InjectRepository(Shift) private readonly shiftRepository: Repository<Shift>,
    private readonly dataSource: DataSource,
  ) { }

  // ==================== INICIO DE LA CORRECCIÓN ====================
  // Función modificada para usar la vista v_inventory_movements_ui y filtrar correctamente por rol.
  async getInventoryMovements(
    startDate: string,
    endDate: string,
    movementType?: string,
    productId?: number,
    tankId?: number,
    user?: User,
  ) {
    const params: any[] = [startDate, endDate];
    let whereClauses: string[] = [`fecha_hora::date BETWEEN $1 AND $2`];

    // Filtro inteligente por rol de usuario
    if (user && user.role !== 'superadmin' && user.role !== 'admin') {
      params.push(user.user_id);
      whereClauses.push(`user_id = $${params.length}`);
    }
    if (movementType) {
      params.push(movementType);
      whereClauses.push(`LOWER(tipo) = LOWER($${params.length})`);
    }

    if (productId) {
      params.push(productId);
      whereClauses.push(`product_id = $${params.length}`);
    }
    if (tankId) {
      params.push(tankId);
      whereClauses.push(`tank_id = $${params.length}`);
    }

    const whereString = whereClauses.join(' AND ');

    const sql = `
        SELECT 
            user_id, fecha_hora, product_id, producto, tank_id, tanque, tipo, cantidad, motivo
        FROM 
            public.v_inventory_movements_ui
        WHERE 
            ${whereString}
        ORDER BY 
            fecha_hora DESC;
    `;

    const rawResults = await this.dataSource.query(sql, params);

    const movementDetails = rawResults.map(item => ({
      ...item,
      cantidad: Number(item.cantidad || 0),
    }));

    // El frontend espera un objeto con este formato
    return {
      movementDetails,
      movementsCount: movementDetails.length,
      totalIn: movementDetails.filter(m => m.tipo === 'Entrada').reduce((sum, m) => sum + m.cantidad, 0),
      totalOut: movementDetails.filter(m => m.tipo === 'Salida').reduce((sum, m) => sum + m.cantidad, 0),
      netAdjustments: movementDetails.filter(m => m.tipo !== 'Entrada' && m.tipo !== 'Salida').reduce((sum, m) => sum + m.cantidad, 0),
    };
  }
  // ==================== FIN DE LA CORRECCIÓN ====================

  // ==================== AUX ====================
  private formatDateLima(d: Date | string) {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString('en-CA', { timeZone: this.tz });
  }

  columnsForGranularity(granularity: 'day' | 'week' | 'month' | 'shift'): ColumnDef[] {
    if (granularity === 'shift') {
      return [
        { header: 'Turno', key: 'shift_name', width: 28 },
        { header: 'Pedidos', key: 'orders' },
        { header: 'Total', key: 'total', currency: true },
      ];
    }
    return [
      { header: 'Bucket', key: 'bucket', width: 18 },
      { header: 'Pedidos', key: 'orders' },
      { header: 'Total', key: 'total', currency: true },
    ];
  }

  private applyFilters(qb: SelectQueryBuilder<Sale>, q: SalesByPeriodQueryDto) {
    if (q.startDate && q.endDate) {
      qb.where('DATE(sale.sale_timestamp) BETWEEN :start AND :end', {
        start: q.startDate,
        end: q.endDate,
      });
    } else {
      qb.where('sale.sale_timestamp IS NOT NULL');
    }

    if (q.productId) {
      qb.andWhere('sd.product_id = :productId', { productId: q.productId })
        .leftJoin('sale.saleDetails', 'sd');
    }

    if (q.employeeId) qb.andWhere('sale.employee_id = :employeeId', { employeeId: q.employeeId });
    if (q.clientId) qb.andWhere('sale.client_id = :clientId', { clientId: q.clientId });

    if (q.paymentMethod) {
      qb.leftJoin('sale.paymentMethod', 'pm')
        .andWhere('pm.method_name = :pm', { pm: q.paymentMethod });
    }

    return qb;
  }

  private buildTimeBucket(granularity: Granularity): string {
    if (granularity === 'week') {
      return `date_trunc('week',  sale.sale_timestamp AT TIME ZONE '${this.tz}')`;
    }
    if (granularity === 'month') {
      return `date_trunc('month', sale.sale_timestamp AT TIME ZONE '${this.tz}')`;
    }
    return `date_trunc('day',   sale.sale_timestamp AT TIME ZONE '${this.tz}')`;
  }

  // ===== Helpers de diseño Excel (reutilizables) =====
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
    colCount: number
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
    ws.getCell('A2').font = { italic: true, size: 11, color: { argb: '111111' } };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    ws.mergeCells(`A3:${endCol}3`);
  }

  private styleExcelTable(
    ws: ExcelJS.Worksheet,
    headerRowIndex: number,
    colCount: number,
    dataStartRow = headerRowIndex + 1
  ) {
    const { PRIMARY_LIGHT, GRAY_BG, WHITE } = this.excelBrand;

    const headerRow = ws.getRow(headerRowIndex);
    headerRow.eachCell((c) => {
      c.font = { bold: true, color: { argb: WHITE } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_LIGHT } };
      c.border = {
        top: { style: 'thin', color: { argb: 'DDDDDD' } },
        left: { style: 'thin', color: { argb: 'DDDDDD' } },
        right: { style: 'thin', color: { argb: 'DDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'DDDDDD' } },
      };
    });

    const lastRow = ws.lastRow?.number ?? dataStartRow;
    for (let r = dataStartRow; r <= lastRow; r++) {
      const row = ws.getRow(r);
      row.eachCell((c, col) => {
        if ((r - dataStartRow) % 2 === 0) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } };
        }
        const hdr = ws.getRow(headerRowIndex).getCell(col).value?.toString() ?? '';
        if (['Subtotal', 'Total Venta', 'Descuento', 'Impuestos', 'Monto', 'Monto (S/)', 'Total', 'Valor'].includes(hdr)) {
          c.numFmt = '[$S/] #,##0.00';
          c.alignment = { horizontal: 'right' };
        } else if (['Fecha', 'Fecha/Hora'].includes(hdr)) {
          c.numFmt = 'yyyy-mm-dd hh:mm';
          c.alignment = { horizontal: 'center' };
        } else if (['Venta', 'Cliente ID', 'Cant. Total', 'Pedidos', 'Crédito', 'Venta'].includes(hdr)) {
          c.alignment = { horizontal: 'center' };
        }
      });
    }

    for (let c = 1; c <= colCount; c++) {
      const col = ws.getColumn(c);
      let max = 10;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const v = cell.value ? cell.value.toString() : '';
        max = Math.max(max, v.length + 2);
      });
      col.width = Math.min(max, 35);
    }

    ws.views = [{ state: 'frozen', ySplit: headerRowIndex }];
    ws.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: colCount },
    };
  }


  private addExcelTotals(ws: ExcelJS.Worksheet, headerRowIndex: number, labels: { key: string; label: string; fmt?: string }[]) {
    const startData = headerRowIndex + 1;
    const endData = ws.lastRow?.number ?? startData;
    const sumRow = endData + 2;

    ws.mergeCells(`A${sumRow}:B${sumRow}`);
    ws.getCell(`A${sumRow}`).value = 'Totales';
    ws.getCell(`A${sumRow}`).font = { bold: true, size: 12 };

    const letter = (idx: number) => ws.getColumn(idx).letter;
    labels.forEach((l, i) => {
      const headerValues = ws.getRow(headerRowIndex).values as any[];
      const colIdx = headerValues ? headerValues.indexOf(l.key) : -1;
      if (colIdx > 0) {
        const labelColIdx = 3 + i * 2;
        ws.getCell(sumRow, labelColIdx).value = l.label;
        ws.getCell(sumRow, labelColIdx + 1).value = {
          formula: `SUBTOTAL(9,${letter(colIdx)}${startData}:${letter(colIdx)}${endData})`,
        } as any;
        if (l.fmt === 'currency') ws.getCell(sumRow, labelColIdx + 1).numFmt = '[$S/] #,##0.00';
      }
    });
  }

  // ==================== INVENTARIO (UI): movimientos por usuario (VIEW) ====================
  async getInventoryMovementsUI(
    userId: number,
    startDate: string,
    endDate: string,
  ) {
    const sql = `
      SELECT
        user_id,
        fecha_hora,
        product_id,
        producto,
        tank_id,
        tanque,
        tipo,
        cantidad,
        motivo
      FROM v_inventory_movements_ui
      WHERE user_id = $1
        AND DATE(fecha_hora) BETWEEN $2 AND $3
ORDER BY fecha_hora DESC;
    `;
    const rows = await this.dataSource.query(sql, [userId, startDate, endDate]);
    return rows.map((r: any) => ({
      ...r,
      cantidad: r.cantidad != null ? Number(r.cantidad) : null,
    }));
  }

  // ==================== INVENTARIO UI POR USUARIO (SQL directo) ====================
  async getInventoryMovementsByUserUI(
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<Array<{
    user_id: number;
    fecha_hora: string;
    product_id: number | null;
    producto: string | null;
    tank_id: number | null;
    tanque: string | null;
    tipo: 'Entrada' | 'Salida' | 'Ajuste';
    cantidad: number;
    motivo: string;
  }>> {
    const sql = `
    WITH params AS (
      SELECT $1::int AS uid, $2::date AS d1, $3::date AS d2
    )
    SELECT
      im.user_id,
      (im.movement_timestamp AT TIME ZONE '${this.tz}') AS fecha_hora,
      p.product_id,
      p.name                                       AS producto,
      t.tank_id,
      t.tank_name                                    AS tanque,
      CASE
        WHEN im.movement_type IN ('in','delivery','recepcion')  THEN 'Entrada'
        WHEN im.movement_type IN ('out','sale','venta')         THEN 'Salida'
        ELSE INITCAP(im.movement_type)
      END                                          AS tipo,
      im.quantity                                  AS cantidad,
      COALESCE(
        NULLIF(TRIM(im.description), ''),
        CASE
          WHEN im.sale_detail_id     IS NOT NULL THEN 'Por venta'
          WHEN im.delivery_detail_id IS NOT NULL THEN 'Por recepción'
          ELSE 'Ajuste'
        END
      )                                            AS motivo
    FROM stock_movements im
    LEFT JOIN products p ON p.product_id = im.product_id
    LEFT JOIN tanks    t ON t.tank_id    = im.tank_id
    CROSS JOIN params par
    WHERE im.user_id = par.uid
      AND DATE(im.movement_timestamp AT TIME ZONE '${this.tz}')
          BETWEEN par.d1 AND par.d2
    ORDER BY fecha_hora DESC;
  `;
    const rows = await this.dataSource.query(sql, [userId, startDate, endDate]);
    return rows.map((r: any) => ({
      user_id: r.user_id,
      fecha_hora: r.fecha_hora,
      product_id: r.product_id ?? null,
      producto: r.producto ?? null,
      tank_id: r.tank_id ?? null,
      tanque: r.tanque ?? null,
      tipo: r.tipo as 'Entrada' | 'Salida' | 'Ajuste',
      cantidad: Number(r.cantidad ?? 0),
      motivo: r.motivo ?? '',
    }));
  }


  // SOLO PARA REPORTES: mismo SELECT pero con ORDER BY seguro.
  // No modifica el método existente ni la BD.
  async getInventoryMovementsByUserUIForReport(
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<Array<{
    user_id: number;
    fecha_hora: string;
    product_id: number | null;
    producto: string | null;
    tank_id: number | null;
    tanque: string | null;
    tipo: 'Entrada' | 'Salida' | 'Ajuste';
    cantidad: number;
    motivo: string;
  }>> {
    const sql = `
    WITH params AS (
      SELECT $1::int AS uid, $2::date AS d1, $3::date AS d2
    )
    SELECT
      im.user_id,
      (im.movement_timestamp AT TIME ZONE '${this.tz}')                                  AS fecha_hora,
      p.product_id,
      p.name                                                                              AS producto,
      t.tank_id,
      t.tank_name                                                                         AS tanque,
      CASE
        WHEN im.movement_type IN ('in','delivery','recepcion')  THEN 'Entrada'
        WHEN im.movement_type IN ('out','sale','venta')         THEN 'Salida'
        ELSE INITCAP(im.movement_type)
      END                                                                               AS tipo,
      im.quantity                                                                       AS cantidad,
      COALESCE(
        NULLIF(TRIM(im.description), ''),
        CASE
          WHEN im.sale_detail_id     IS NOT NULL THEN 'Por venta'
          WHEN im.delivery_detail_id IS NOT NULL THEN 'Por recepción'
          ELSE 'Ajuste'
        END
      )                                                                                 AS motivo
    FROM stock_movements im
    LEFT JOIN products p ON p.product_id = im.product_id
    LEFT JOIN tanks    t ON t.tank_id    = im.tank_id
    CROSS JOIN params par
    WHERE im.user_id = par.uid
      AND DATE(im.movement_timestamp AT TIME ZONE '${this.tz}')
          BETWEEN par.d1 AND par.d2
    ORDER BY fecha_hora DESC;
  `;
    const rows = await this.dataSource.query(sql, [userId, startDate, endDate]);
    return rows.map((r: any) => ({
      user_id: r.user_id,
      fecha_hora: r.fecha_hora,
      product_id: r.product_id ?? null,
      producto: r.producto ?? null,
      tank_id: r.tank_id ?? null,
      tanque: r.tanque ?? null,
      tipo: r.tipo as 'Entrada' | 'Salida' | 'Ajuste',
      cantidad: Number(r.cantidad ?? 0),
      motivo: r.motivo ?? '',
    }));
  }

  async exportInventoryMovementsByUserUIToExcel(opts: {
    userName: string;
    userId: number;
    startDate: string;
    endDate: string;
    rows: Awaited<ReturnType<ReportsService['getInventoryMovementsByUserUI']>>;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Inventario (usuario)');

    // Título y subtítulo corporativo
    const invCols = 6;
    this.addExcelBrandHeader(
      ws,
      'Movimientos de Inventario por Usuario',
      `Usuario: ${opts.userName} (ID: ${opts.userId}) | Período: ${opts.startDate} - ${opts.endDate} | Generado: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      invCols
    );

    // Header (fila 5)
    ws.columns = [
      { header: 'Fecha/Hora', key: 'fecha_hora', width: 22 },
      { header: 'Producto', key: 'producto', width: 30 },
      { header: 'Tanque', key: 'tanque', width: 22 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Cantidad', key: 'cantidad', width: 14 },
      { header: 'Motivo', key: 'motivo', width: 32 },
    ];
    ws.getRow(5).values = ws.columns.map(c => (c as any).header);

    const data = opts.rows.map(r => ({
      fecha_hora: r.fecha_hora,
      producto: r.producto ?? '',
      tanque: r.tanque ?? '',
      tipo: r.tipo ?? '',
      cantidad: r.cantidad ?? 0,
      motivo: r.motivo ?? '',
    }));

    ws.addRows(data);
    ws.getColumn('cantidad').numFmt = '#,##0.000';
    ws.getColumn('fecha_hora').numFmt = 'yyyy-mm-dd hh:mm';

    // Estilo y totales
    this.styleExcelTable(ws, 5, invCols);
    this.addExcelTotals(ws, 5, [{ key: 'Cantidad', label: 'Total Cantidad' }]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ==================== NUEVO: VENTAS DETALLADAS POR USUARIO ====================
  async getSalesByUserDetailed(
    userId: number,
    startDate: string,
    endDate: string,
  ) {
    const sql = `
      WITH bounds AS (
        SELECT
          (to_timestamp($2, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}')           AS ts_from_utc,
          (to_timestamp($3, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}') + INTERVAL '1 day' AS ts_to_excl_utc
      )
      SELECT
        s.sale_id,
        s.user_id,
        s.employee_id,
        s.client_id,
        s.sale_timestamp,
        s.status,
        COALESCE(s.final_amount, s.total_amount)                       AS total_amount,
        COALESCE(pm.method_name, pm.name)                             AS payment_method,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', cl.first_name, cl.last_name)), ''), 'Consumidor Final') AS client_name,

        CASE
          WHEN COALESCE(SUM(sd.quantity),0) > 0 THEN COALESCE(SUM(sd.quantity),0)
          ELSE
            CASE WHEN p_n.unit_price > 0
                 THEN (COALESCE(s.final_amount, s.total_amount)) / p_n.unit_price
                 ELSE NULL
            END
        END                                                           AS total_qty,

        JSON_AGG(
          JSON_BUILD_OBJECT(
            'product_id',   COALESCE(sd.product_id, p_n.product_id),
            'product_name', COALESCE(p_sd.name,     p_n.name),
            'quantity',     COALESCE(
                              sd.quantity,
                              CASE WHEN p_n.unit_price > 0
                                   THEN COALESCE(sd.subtotal, (COALESCE(s.final_amount, s.total_amount))) / p_n.unit_price
                                   ELSE NULL
                              END
                            ),
            'unit_price',   COALESCE(sd.unit_price_at_sale, p_n.unit_price),
            'subtotal',     COALESCE(sd.subtotal, (COALESCE(s.final_amount, s.total_amount)))
          )
          ORDER BY COALESCE(p_sd.name, p_n.name)
        ) AS items
      FROM sales s
      LEFT JOIN sale_details     sd   ON sd.sale_id      = s.sale_id
      LEFT JOIN products         p_sd ON p_sd.product_id = sd.product_id
      LEFT JOIN nozzles          n    ON n.nozzle_id     = s.nozzle_id
      LEFT JOIN products         p_n  ON p_n.product_id  = n.product_id
      LEFT JOIN clients          cl   ON cl.client_id    = s.client_id
      LEFT JOIN payment_methods  pm   ON pm.payment_method_id = s.payment_method_id
      CROSS JOIN bounds b
      WHERE
        s.user_id = $1
        AND s.status IN ('completed','paid','finalized')
        AND s.sale_timestamp >= b.ts_from_utc
        AND s.sale_timestamp <  b.ts_to_excl_utc
      GROUP BY
        s.sale_id, s.user_id, s.employee_id, s.client_id,
        s.sale_timestamp, s.status, s.total_amount, s.final_amount,
        pm.method_name, pm.name, cl.first_name, cl.last_name, p_n.unit_price
      ORDER BY s.sale_id DESC;
    `;

    const rows = await this.dataSource.query(sql, [userId, startDate, endDate]);
    return rows.map((r: any) => ({
      sale_id: r.sale_id,
      user_id: r.user_id,
      employee_id: r.employee_id ?? null,
      client_id: r.client_id ?? null,
      client_name: r.client_name ?? 'Consumidor Final',
      sale_timestamp: r.sale_timestamp,
      status: r.status,
      total_amount: Number(r.total_amount ?? 0),
      total_qty: r.total_qty != null ? Number(r.total_qty) : null,
      payment_method: r.payment_method ?? null,
      items: Array.isArray(r.items)
        ? r.items.map((it: any) => ({
          product_id: it.product_id ?? null,
          product_name: it.product_name ?? null,
          quantity: it.quantity != null ? Number(it.quantity) : null,
          unit_price: it.unit_price != null ? Number(it.unit_price) : null,
          subtotal: Number(it.subtotal ?? 0),
        }))
        : [],
    }));
  }

  async exportUserDetailedToExcel(opts: {
    userName: string;
    userId: number;
    startDate: string;
    endDate: string;
    rows: Awaited<ReturnType<ReportsService['getSalesByUserDetailed']>>;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ventas usuario');

    const colCount = 11; // columnas del detalle

    // Encabezado corporativo
    this.addExcelBrandHeader(
      ws,
      'Reporte de Ventas por Usuario',
      `Usuario: ${opts.userName} (ID: ${opts.userId}) | Período: ${opts.startDate} - ${opts.endDate} | Generado: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      colCount
    );

    // Header en fila 5
    ws.addRow([]);
    ws.addRow([
      'Venta', 'Fecha', 'Cliente ID', 'Cliente', 'Pago',
      'Producto', 'Cantidad', 'Precio Unit.', 'Subtotal', 'Total Venta', 'Cant. Total',
    ]);
    ws.getRow(5).values = [
      'Venta', 'Fecha', 'Cliente ID', 'Cliente', 'Pago',
      'Producto', 'Cantidad', 'Precio Unit.', 'Subtotal', 'Total Venta', 'Cant. Total',
    ];

    for (const sale of opts.rows) {
      if (!sale.items?.length) {
        ws.addRow([
          sale.sale_id,
          new Date(sale.sale_timestamp),
          sale.client_id ?? '',
          sale.client_name ?? '',
          sale.payment_method ?? '',
          '(sin items)',
          null,
          null,
          0,
          Number(sale.total_amount ?? 0),
          sale.total_qty ?? null,
        ]);
        continue;
      }
      sale.items.forEach((it, idx) => {
        ws.addRow([
          idx === 0 ? sale.sale_id : '',
          idx === 0 ? new Date(sale.sale_timestamp) : '',
          idx === 0 ? (sale.client_id ?? '') : '',
          idx === 0 ? (sale.client_name ?? '') : '',
          idx === 0 ? (sale.payment_method ?? '') : '',
          it.product_name ?? '',
          it.quantity ?? null,
          it.unit_price ?? null,
          it.subtotal ?? 0,
          idx === 0 ? Number(sale.total_amount ?? 0) : '',
          idx === 0 ? (sale.total_qty ?? null) : '',
        ]);
      });
    }

    ws.getColumn(2).numFmt = 'yyyy-mm-dd hh:mm';
    ws.getColumn(7).numFmt = '#,##0.00';
    ws.getColumn(8).numFmt = '#,##0.00';
    ws.getColumn(9).numFmt = '#,##0.00';
    ws.getColumn(10).numFmt = '#,##0.00';
    ws.getColumn(11).numFmt = '#,##0.00';

    // Estilo y totales
    this.styleExcelTable(ws, 5, colCount);
    this.addExcelTotals(ws, 5, [
      { key: 'Subtotal', label: 'Subtotal (S/)', fmt: 'currency' },
      { key: 'Total Venta', label: 'Total Venta (S/)', fmt: 'currency' },
      { key: 'Cant. Total', label: 'Total Cantidad' },
    ]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ==================== CRÉDITOS: POR USUARIO (creados) ====================
  async getCreditsByUser(userId: number, startDate: string, endDate: string) {
    const sql = `
      SELECT
        c.credit_id,
        c.sale_id,
        c.client_id,
        CONCAT_WS(' ', cl.first_name, cl.last_name) AS client_name,
        c.credit_amount,
        COALESCE(c.amount_paid, 0) AS amount_paid,
        (c.credit_amount - COALESCE(c.amount_paid,0)) AS remaining_balance,
        c.due_date,
        s.user_id,
        s.sale_timestamp
      FROM credits c
      JOIN sales    s  ON s.sale_id = c.sale_id
      LEFT JOIN clients cl ON cl.client_id = c.client_id
      WHERE s.user_id = $1
        AND DATE(s.sale_timestamp AT TIME ZONE '${this.tz}') BETWEEN $2 AND $3
      ORDER BY c.credit_id DESC;
    `;
    const rows = await this.dataSource.query(sql, [userId, startDate, endDate]);
    return rows.map((r: any) => ({
      ...r,
      credit_amount: Number(r.credit_amount || 0),
      amount_paid: Number(r.amount_paid || 0),
      remaining_balance: Number(r.remaining_balance || 0),
    }));
  }

  // ==================== CRÉDITOS: PAGOS por USUARIO ====================
  async getCreditPaymentsByUser(userId: number, startDate: string, endDate: string) {
    const sql = `
      SELECT
        p.payment_id,
        p.credit_id,
        p.amount,
        p.payment_timestamp,
        COALESCE(pm.method_name, pm.name) AS payment_method,
        c.client_id,
        CONCAT_WS(' ', cl.first_name, cl.last_name) AS client_name,
        s.sale_id,
        COALESCE(p.user_id, s.user_id) AS user_id
      FROM payments p
      JOIN credits c ON c.credit_id = p.credit_id
      JOIN sales   s ON s.sale_id   = c.sale_id
      LEFT JOIN clients cl ON cl.client_id = c.client_id
      LEFT JOIN payment_methods pm ON pm.payment_method_id = p.payment_method_id
      WHERE
        (p.user_id = $1 OR (p.user_id IS NULL AND s.user_id = $1))
        AND DATE(p.payment_timestamp AT TIME ZONE '${this.tz}') BETWEEN $2 AND $3
      ORDER BY p.payment_timestamp DESC, p.payment_id DESC;
    `;
    const rows = await this.dataSource.query(sql, [userId, startDate, endDate]);
    return rows.map((r: any) => ({
      ...r,
      amount: Number(r.amount || 0),
    }));
  }

  // ==================== AGREGADOS / EXPORTS ====================
  async getSalesAggregated(q: SalesByPeriodQueryDto) {
    const gran = q.granularity ?? 'day';

    if (gran === 'shift') {
      const qb = this.saleRepository.createQueryBuilder('sale');

      // Reutiliza tu filtro de fechas/producto/empleado/etc.
      this.applyFilters(qb, q);

      // 👉 Solo ventas finalizadas (igual que el resto de reportes)
      qb.andWhere(`sale.status IN ${SOLD_STATUS}`);

      qb
        .leftJoin(Shift, 'sh', 'sh.shift_id = sale.shift_id')
        .select('sale.shift_id', 'shift_id')
        .addSelect(`COALESCE(sh.shift_name, 'Sin turno')`, 'shift_name')
        .addSelect('COUNT(*)', 'orders')
        // usa la misma expresión de monto que en otros reportes
        .addSelect(`SUM(${AMOUNT_EXPR})`, 'total')
        .groupBy('sale.shift_id')
        .addGroupBy('sh.shift_name')
        .orderBy('shift_name', 'ASC');

      const rawResults = await qb.getRawMany();
      return rawResults.map(row => ({
        shift_id: row.shift_id ? Number(row.shift_id) : null,
        shift_name: row.shift_name ?? 'Sin turno',
        orders: Number(row.orders || 0),
        total: Number(row.total || 0),
      }));
    }

    const bucketExpr = this.buildTimeBucket(gran);
    const qb = this.saleRepository.createQueryBuilder('sale')
      .select(bucketExpr, 'bucket')
      .addSelect('COUNT(*)', 'orders')
      .addSelect(`SUM(${AMOUNT_EXPR})`, 'total'); // ← antes: SUM(sale.total_amount)

    this.applyFilters(qb, q);
    qb.andWhere(`sale.status IN ${SOLD_STATUS}`); // ← añade este filtro como en la rama shift
    qb.groupBy('bucket').orderBy('bucket', 'ASC');

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      bucket: r.bucket instanceof Date ? r.bucket.toISOString() : r.bucket,
      orders: Number(r.orders ?? 0),
      total: Number(r.total ?? 0),
    }));
  }

  async exportSalesAggregationToExcel(rows: any[], q: SalesByPeriodQueryDto): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ventas');

    const isShift = (q.granularity ?? 'day') === 'shift';
    const colCount = 3;

    // Header corporativo
    this.addExcelBrandHeader(
      ws,
      'Reporte de Ventas (Agregado)',
      `Período: ${q.startDate ?? ''} - ${q.endDate ?? ''} | Generado: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      colCount
    );

    // Header en fila 5
    if (isShift) {
      ws.getRow(5).values = ['Turno', 'Pedidos', 'Total'];
      rows.forEach(r => ws.addRow([r.shift_name ?? r.shift_id ?? 'Sin turno', r.orders ?? 0, Number(r.total ?? 0)]));
    } else {
      ws.getRow(5).values = ['Bucket', 'Pedidos', 'Total'];
      rows.forEach(r => ws.addRow([r.bucket, r.orders ?? 0, Number(r.total ?? 0)]));
    }
    ws.getColumn(3).numFmt = '#,##0.00';

    // Estilo + totales
    this.styleExcelTable(ws, 5, colCount);
    this.addExcelTotals(ws, 5, [{ key: 'Total', label: 'Total (S/)', fmt: 'currency' }]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportAggregationToExcel(opts: { rows: any[]; title: string; columns: ColumnDef[]; }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Reporte');
    const colCount = opts.columns.length;

    // Branding
    this.addExcelBrandHeader(
      ws,
      opts.title,
      `Generado: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      colCount
    );

    // Header fila 2 (lo dejamos como 5 para uniformidad visual)
    ws.getRow(5).values = opts.columns.map(c => c.header);

    const processedRows = opts.rows.map(r => {
      const row: any[] = [];
      for (const c of opts.columns) {
        let val = (r as any)[c.key];
        if (c.key === 'bucket' && val) val = this.formatDateLima(val);
        if (c.currency) val = Number(val ?? 0);
        row.push(val ?? '');
      }
      return row;
    });

    ws.addRows(processedRows);

    // Formatos de moneda según definición
    opts.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.width) (col as any).width = c.width;
      if (c.currency) (col as any).numFmt = '[$S/] #,##0.00';
    });

    // Estilo y totales de columnas currency
    this.styleExcelTable(ws, 5, colCount);
    const currencyTotals = opts.columns
      .map((c) => c.currency ? { key: c.header, label: `Total ${c.header}`, fmt: 'currency' as const } : null)
      .filter(Boolean) as { key: string; label: string; fmt?: string }[];
    if (currencyTotals.length) this.addExcelTotals(ws, 5, currencyTotals);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportAggregationToPDF(opts: { rows: any[]; title: string; columns: ColumnDef[]; landscape?: boolean; }): Promise<Buffer> {
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };
    const printer = new PdfPrinter(fonts);
    const body: TableCell[][] = [];
    body.push(opts.columns.map(c => ({ text: c.header, bold: true, color: '#FFFFFF' })) as TableCell[]);

    for (const r of opts.rows) {
      const row: TableCell[] = [];
      for (const c of opts.columns) {
        let val: any = (r as any)[c.key];
        if (c.key === 'bucket' && val) val = this.formatDateLima(val);
        if (c.currency) val = Number(val ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 });
        row.push({ text: val ?? '' });
      }
      body.push(row);
    }

    const dd: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: opts.landscape ? 'landscape' : 'portrait',
      pageMargins: [36, 72, 36, 54],
      header: {
        margin: [36, 24, 36, 0],
        columns: [
          { text: opts.title, style: 'title', alignment: 'center', margin: [0, 8, 0, 0] },
        ],
      },
      footer: (currentPage, pageCount) => ({
        margin: [36, 0, 36, 24],
        columns: [
          { text: `Generado: ${new Date().toLocaleString('es-PE', { timeZone: this.tz })}`, style: 'foot' },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', style: 'foot' },
        ],
      }),
      content: [
        {
          table: {
            headerRows: 1,
            widths: opts.columns.map(() => 'auto'),
            body,
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#3B82F6' : (rowIndex % 2 === 0 ? '#F3F4F6' : null),
            hLineWidth: () => 0.5, vLineWidth: () => 0.5,
            hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB',
          },
          margin: [0, 8, 0, 0]
        },
        {
          columns: [
            { text: `Filas: ${opts.rows.length}`, alignment: 'left', margin: [0, 10, 0, 0] },
            { text: `Hora: ${new Date().toLocaleTimeString('es-PE', { timeZone: this.tz })}`, alignment: 'right', margin: [0, 10, 0, 0] }
          ]
        }
      ],
      styles: {
        title: { fontSize: 16, bold: true, color: '#111111' },
        foot: { fontSize: 9, color: '#6B7280' },
      },
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
    };

    return await new Promise<Buffer>((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(dd);
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (c) => chunks.push(c));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }

  // Exponer un método explícito “by-shift”
  // grifosis-main/src/reports/reports.service.ts
  async getSalesByShift(startDate: string, endDate: string) {
    const rows = await this.saleRepository.createQueryBuilder('s')
      // 🔸 No hay shift_id en sales. Usamos el texto 'shift'
      .select('COALESCE(NULLIF(TRIM(s.shift), \'\'), \'Sin turno\')', 'shift_name')
      .addSelect('COUNT(*)', 'orders')
      .addSelect(`SUM(COALESCE(s.final_amount, s.total_amount))`, 'total')
      .where('DATE(s.sale_timestamp) BETWEEN :d1 AND :d2', { d1: startDate, d2: endDate })
      .andWhere(`s.status IN ('completed','paid','finalized')`)
      .groupBy('COALESCE(NULLIF(TRIM(s.shift), \'\'), \'Sin turno\')')
      .orderBy('shift_name', 'ASC')
      .getRawMany();

    return rows.map(r => ({
      shift_id: null,                         // ya no aplica
      shift_name: r.shift_name ?? 'Sin turno',
      orders: Number(r.orders || 0),
      total: Number(r.total || 0),
    }));
  }


  // ==================== DETALLADO POR EMPLEADO ====================
  async findEmployeeById(employeeId: number): Promise<Employee | null> {
    return this.employeeRepository.findOne({ where: { employee_id: employeeId } });
  }

  async getDetailedEmployeeReport(employeeId: number, startDate: string, endDate: string) {
    const salesSummary = await this.getSalesSummaryByEmployee(employeeId, startDate, endDate);
    const detailedSales = await this.getSalesByEmployeeDetailed(employeeId, startDate, endDate);
    const inventoryMovements = await this.getInventoryMovementsByEmployee(employeeId, startDate, endDate);
    const collections = await this.getCollectionsByEmployee(employeeId, startDate, endDate);

    return {
      employeeId,
      salesSummary,
      detailedSales,
      inventoryMovements,
      collections,
    };
  }

  async getSalesByEmployeeDetailed(employeeId: number, startDate: string, endDate: string) {
    const queryBuilder = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.saleDetails', 'saleDetail')
      .leftJoinAndSelect('saleDetail.product', 'product')
      .leftJoinAndSelect('sale.client', 'client')
      .leftJoinAndSelect('sale.paymentMethod', 'paymentMethod')
      .where('sale.sale_timestamp BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      })

      .andWhere('sale.employee_id = :employeeId', { employeeId });

    return await queryBuilder.getMany();
  }

  async getInventoryMovementsByEmployee(employeeId: number, startDate: string, endDate: string) {
    const queryBuilder = this.stockMovementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .leftJoinAndSelect('movement.tank', 'tank')
      .where('movement.movement_timestamp BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      })
      // Nota: si movement.user_id guarda "user_id" y no "employee_id", aquí se filtra por user_id.
      .andWhere('movement.user_id = :employeeId', { employeeId });

    return queryBuilder.getMany();
  }

  async getCollectionsByEmployee(employeeId: number, startDate: string, endDate: string) {
    const queryBuilder = this.saleRepository.manager
      .createQueryBuilder()
      .select('p.payment_id', 'payment_id')
      .addSelect('p.amount', 'amount')
      .addSelect('p.payment_timestamp', 'payment_date')
      .addSelect('pm.name', 'payment_method')
      .addSelect('c.client_id', 'client_id')
      .addSelect("CONCAT_WS(' ', cl.first_name, cl.last_name)", 'client_name')
      .from('payments', 'p')
      .leftJoin('payment_methods', 'pm', 'p.payment_method_id = pm.payment_method_id')
      .leftJoin('credits', 'c', 'p.credit_id = c.credit_id')
      .leftJoin('sales', 's', 'c.sale_id = s.sale_id')
      .leftJoin('clients', 'cl', 'c.client_id = cl.client_id');

    if (startDate && endDate) {
      queryBuilder.where('DATE(p.payment_timestamp) BETWEEN :startDate AND :endDate', { startDate, endDate });
    } else {
      queryBuilder.where('p.payment_timestamp IS NOT NULL');
    }

    queryBuilder.andWhere('p.credit_id IS NOT NULL');
    queryBuilder.andWhere('s.employee_id = :employeeId', { employeeId });

    const rawResults = await queryBuilder.getRawMany();
    const collectionsDetails = rawResults.map(row => ({ ...row, amount: Number(row.amount || 0) }));
    const totalCollections = collectionsDetails.reduce((sum, c) => sum + c.amount, 0);

    return { totalCollections, collectionsDetails };
  }

  async exportDetailedEmployeeReportToExcel(opts: {
    reportData: any;
    employeeName: string;
    startDate: string;
    endDate: string;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    const wsSummary = wb.addWorksheet('Resumen General');
    wsSummary.columns = [
      { header: 'Concepto', key: 'concepto', width: 40 },
      { header: 'Valor', key: 'valor', width: 20 },
    ];
    wsSummary.addRow([`Reporte Detallado de Empleado: ${opts.employeeName}`]);
    wsSummary.addRow([`Período: ${opts.startDate} - ${opts.endDate}`]);
    wsSummary.addRow([]);

    const ss = opts.reportData?.salesSummary ?? {};
    const totalSales = ss.totalSales ??
      (Array.isArray(ss.rankingData)
        ? ss.rankingData.reduce((acc: number, it: any) => acc + Number(it.total ?? it.totalSales ?? 0), 0)
        : 0);
    const salesCount = ss.salesCount ??
      (Array.isArray(ss.rankingData)
        ? ss.rankingData.reduce((acc: number, it: any) => acc + Number(it.orders ?? it.salesCount ?? 0), 0)
        : 0);

    const totalCollections = opts.reportData?.collections?.totalCollections ?? 0;

    wsSummary.addRow(['Ingresos por Ventas', totalSales]);
    wsSummary.addRow(['Total de Órdenes', salesCount]);
    wsSummary.addRow(['Cobranzas de Créditos', totalCollections]);
    wsSummary.getColumn(2).numFmt = '#,##0.00';
    wsSummary.getRow(4).font = { bold: true };
    wsSummary.getRow(5).font = { bold: true };
    wsSummary.getRow(6).font = { bold: true };

    const wsSales = wb.addWorksheet('Ventas Detalladas');
    wsSales.columns = [
      { header: 'ID Venta', key: 'sale_id', width: 12 },
      { header: 'Fecha', key: 'sale_timestamp', width: 20 },
      { header: 'Producto', key: 'product_name', width: 30 },
      { header: 'Cantidad', key: 'quantity', width: 15 },
      { header: 'Precio Unitario', key: 'unit_price', width: 15 },
      { header: 'Subtotal', key: 'subtotal', width: 15 },
      { header: 'Total Venta', key: 'total_amount', width: 15 },
      { header: 'Cliente', key: 'client_name', width: 30 },
      { header: 'Método Pago', key: 'payment_method_name', width: 20 },
    ];
    wsSales.getRow(1).font = { bold: true };

    const detailedSales = Array.isArray(opts.reportData?.detailedSales)
      ? opts.reportData.detailedSales
      : [];

    const salesRows: any[] = [];
    detailedSales.forEach((sale: any) => {
      const saleId = sale.sale_id ?? sale.id ?? '';
      const saleTs = sale.sale_timestamp ?? sale.date ?? sale.created_at ?? '';
      const clientName =
        sale.client?.full_name ?? sale.client?.name ?? sale.client_name ?? 'Consumidor Final';
      const paymentName =
        sale.paymentMethod?.method_name ??
        sale.payment_method?.method_name ??
        sale.payment_method ??
        'Efectivo';

      if (Array.isArray(sale.saleDetails) && sale.saleDetails.length) {
        sale.saleDetails.forEach((d: any) => {
          salesRows.push({
            sale_id: saleId,
            sale_timestamp: saleTs,
            product_name: d.product?.name ?? d.product_name ?? '',
            quantity: Number(d.quantity ?? 0),
            unit_price: Number(d.unit_price_at_sale ?? d.unit_price ?? 0),
            subtotal: Number(d.subtotal ?? (Number(d.quantity ?? 0) * Number(d.unit_price_at_sale ?? 0))),
            total_amount: Number(sale.total_amount ?? 0),
            client_name: clientName,
            payment_method_name: paymentName,
          });
        });
      } else if (Array.isArray(sale.items) && sale.items.length) {
        sale.items.forEach((it: any) => {
          salesRows.push({
            sale_id: saleId,
            sale_timestamp: saleTs,
            product_name: it.product?.name ?? it.product_name ?? '',
            quantity: Number(it.quantity ?? 0),
            unit_price: Number(it.unit_price ?? 0),
            subtotal: Number(it.subtotal ?? 0),
            total_amount: Number(sale.total_amount ?? 0),
            client_name: clientName,
            payment_method_name: paymentName,
          });
        });
      } else {
        salesRows.push({
          sale_id: saleId,
          sale_timestamp: saleTs,
          product_name: '(sin items)',
          quantity: null,
          unit_price: null,
          subtotal: 0,
          total_amount: Number(sale.total_amount ?? 0),
          client_name: clientName,
          payment_method_name: paymentName,
        });
      }
    });

    wsSales.addRows(salesRows);
    wsSales.getColumn('quantity').numFmt = '#,##0.00';
    wsSales.getColumn('unit_price').numFmt = '#,##0.00';
    wsSales.getColumn('subtotal').numFmt = '#,##0.00';
    wsSales.getColumn('total_amount').numFmt = '#,##0.00';

    const wsCollections = wb.addWorksheet('Cobranzas');
    wsCollections.columns = [
      { header: 'ID Pago', key: 'payment_id', width: 12 },
      { header: 'Fecha Pago', key: 'payment_date', width: 20 },
      { header: 'Monto', key: 'amount', width: 15 },
      { header: 'Cliente', key: 'client_name', width: 30 },
      { header: 'Método Pago', key: 'payment_method', width: 20 },
      { header: 'Crédito', key: 'credit_id', width: 12 },
      { header: 'Venta', key: 'sale_id', width: 12 },
    ];
    wsCollections.getRow(1).font = { bold: true };

    const colRows = (opts.reportData?.collections?.collectionsDetails ?? []).map((c: any) => ({
      payment_id: c.payment_id,
      payment_date: c.payment_date,
      amount: Number(c.amount ?? 0),
      client_name: c.client_name ?? '',
      payment_method: c.payment_method ?? '',
      credit_id: c.credit_id ?? c.credit ?? '',
      sale_id: c.sale_id ?? '',
    }));
    wsCollections.addRows(colRows);
    wsCollections.getColumn('amount').numFmt = '#,##0.00';

    const wsInventory = wb.addWorksheet('Movimientos de Inventario');
    wsInventory.columns = [
      { header: 'ID Movimiento', key: 'movement_id', width: 15 },
      { header: 'Fecha', key: 'movement_timestamp', width: 22 },
      { header: 'Tipo', key: 'movement_type', width: 16 },
      { header: 'Producto', key: 'product_name', width: 30 },
      { header: 'Tanque', key: 'tank_name', width: 25 },
      { header: 'Cantidad', key: 'quantity', width: 15 },
      { header: 'Motivo', key: 'reason', width: 30 },
    ];
    wsInventory.getRow(1).font = { bold: true };

    const invRows = (opts.reportData?.inventoryMovements ?? []).map((m: any) => ({
      movement_id: m.movement_id ?? m.id ?? '',
      movement_timestamp: m.movement_timestamp ?? m.created_at ?? '',
      movement_type: m.movement_type ?? '',
      product_name: m.product?.name ?? m.product_name ?? '',
      tank_name: m.tank?.tank_name ?? m.tank_name ?? '',
      quantity: Number(m.quantity ?? 0),
      reason: m.reason ?? '',
    }));
    wsInventory.addRows(invRows);
    wsInventory.getColumn('quantity').numFmt = '#,##0.00';

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ==================== REPORTES DE VENTAS (GENÉRICOS) ====================
  async getSalesByPeriod(
    startDate: string,
    endDate: string,
    productId?: number,
    clientId?: number,
    employeeId?: number,
    shiftId?: number,
  ) {
    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.saleDetails', 'saleDetail')
      .leftJoinAndSelect('saleDetail.product', 'product')
      .leftJoinAndSelect('sale.client', 'client')
      .leftJoinAndSelect('sale.employee', 'employee')
      .leftJoinAndSelect('sale.paymentMethod', 'paymentMethod');

    if (startDate && endDate) {
      qb.where('DATE(sale.sale_timestamp) BETWEEN :startDate AND :endDate', { startDate, endDate });
    } else qb.where('sale.sale_timestamp IS NOT NULL');

    if (productId) qb.andWhere('product.product_id = :productId', { productId });
    if (clientId) qb.andWhere('client.client_id = :clientId', { clientId });
    if (employeeId) qb.andWhere('employee.employee_id = :employeeId', { employeeId });

    const sales = await qb.getMany();

    const totalSales = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const totalQuantity = sales.reduce((sum, s) =>
      sum + s.saleDetails.reduce((detailSum, d) => detailSum + Number(d.quantity), 0), 0
    );
    const averageTransaction = sales.length > 0 ? totalSales / sales.length : 0;

    const salesByProduct: Record<string, any> = {};
    sales.forEach(s => {
      s.saleDetails.forEach(d => {
        const productName = d.product.name;
        if (!salesByProduct[productName]) {
          salesByProduct[productName] = { quantity: 0, amount: 0 };
        }
        salesByProduct[productName].quantity += Number(d.quantity);
        salesByProduct[productName].amount += Number(d.subtotal);
      });
    });

    const salesByPaymentMethod: Record<string, number> = {};
    sales.forEach(s => {
      const pm = s.paymentMethod?.method_name || 'Sin especificar';
      salesByPaymentMethod[pm] = (salesByPaymentMethod[pm] || 0) + Number(s.total_amount);
    });

    const timelineData: Record<string, { sales: number; quantity: number }> = {};
    sales.forEach(s => {
      const date = s.sale_timestamp.toISOString().split('T')[0];
      if (!timelineData[date]) timelineData[date] = { sales: 0, quantity: 0 };
      timelineData[date].sales += Number(s.total_amount);
      timelineData[date].quantity += s.saleDetails.reduce((sum, d) => sum + Number(d.quantity), 0);
    });

    return {
      totalSales,
      totalQuantity,
      averageTransaction,
      salesByProduct,
      salesByPaymentMethod,
      timelineData,
      salesCount: sales.length,
    };
  }

  async getSalesSummaryByEmployee(employeeId?: number, startDate?: string, endDate?: string) {
    const qb = this.saleRepository
      .createQueryBuilder('s')
      .leftJoin('s.employee', 'e')
      .select('e.employee_id', 'employee_id')
      .addSelect("CONCAT_WS(' ', e.first_name, e.last_name)", 'employee_name')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('SUM(s.total_amount)', 'total')
      .where('s.sale_timestamp IS NOT NULL')
      .groupBy('e.employee_id')
      .addGroupBy('employee_name')
      .orderBy('total', 'DESC');

    if (employeeId) qb.andWhere('e.employee_id = :employeeId', { employeeId });
    if (startDate && endDate) qb.andWhere('DATE(s.sale_timestamp) BETWEEN :startDate AND :endDate', { startDate, endDate });

    const rawResults = await qb.getRawMany();

    const employeeSales: Record<string, any> = {};
    const rankingData = rawResults.map(row => {
      const employeeName = row.employee_name || 'Sin vendedor';
      const data = {
        employee_id: row.employee_id,
        totalSales: Number(row.total || 0),
        salesCount: Number(row.orders || 0),
        orders: Number(row.orders || 0),
        total: Number(row.total || 0),
      };
      employeeSales[employeeName] = data;
      return { name: employeeName, ...data };
    });

    return { employeeSales, rankingData, totalEmployees: Object.keys(employeeSales).length };
  }

  async getSalesByEmployee(startDate: string, endDate: string, employeeId?: number, shiftId?: number) {
    const qb = this.saleRepository
      .createQueryBuilder('s')
      .leftJoin('s.employee', 'e')
      .select('e.employee_id', 'employee_id')
      .addSelect("CONCAT_WS(' ', e.first_name, e.last_name)", 'employee_name')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('SUM(s.total_amount)', 'total');

    if (startDate && endDate) qb.where('DATE(s.sale_timestamp) BETWEEN :startDate AND :endDate', { startDate, endDate });
    else qb.where('s.sale_timestamp IS NOT NULL');

    qb.groupBy('e.employee_id').addGroupBy('employee_name').orderBy('total', 'DESC');
    if (employeeId) qb.andWhere('e.employee_id = :employeeId', { employeeId });

    const raw = await qb.getRawMany();
    const employeeSales: Record<string, any> = {};
    const rankingData = raw.map(row => {
      const name = row.employee_name || 'Sin vendedor';
      const data = {
        employee_id: row.employee_id,
        totalSales: Number(row.total || 0),
        salesCount: Number(row.orders || 0),
        orders: Number(row.orders || 0),
        total: Number(row.total || 0),
      };
      employeeSales[name] = data;
      return { name, ...data };
    });

    return { employeeSales, rankingData, totalEmployees: Object.keys(employeeSales).length };
  }

  async getSalesByProduct(startDate: string, endDate: string, limit?: number, productId?: number) {
    const qb = this.saleRepository
      .createQueryBuilder('s')
      .leftJoin('s.saleDetails', 'sd')
      .leftJoin('sd.product', 'p')
      .select('p.product_id', 'product_id')
      .addSelect('p.name', 'product_name')
      .addSelect('SUM(sd.quantity)', 'qty')
      .addSelect('SUM(sd.quantity * sd.unit_price_at_sale)', 'revenue');

    if (startDate && endDate) qb.where('DATE(s.sale_timestamp) BETWEEN :startDate AND :endDate', { startDate, endDate });
    else qb.where('s.sale_timestamp IS NOT NULL');

    qb.groupBy('p.product_id').addGroupBy('p.name').orderBy('revenue', 'DESC');
    if (productId) qb.andWhere('p.product_id = :productId', { productId });
    qb.limit(limit ?? 10);

    const raw = await qb.getRawMany();
    const productSales = raw.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name || 'Producto sin nombre',
      quantity: Number(row.qty || 0),
      revenue: Number(row.revenue || 0),
      qty: Number(row.qty || 0),
    }));

    const totalRevenue = productSales.reduce((s, p) => s + p.revenue, 0);
    const totalQuantity = productSales.reduce((s, p) => s + p.quantity, 0);

    return { productSales, totalRevenue, totalQuantity, productsCount: productSales.length };
  }

  async getCurrentStock(productId?: number, tankId?: number) {
    const qb = this.tankRepository.createQueryBuilder('tank').leftJoinAndSelect('tank.product', 'product');
    if (productId) qb.andWhere('product.product_id = :productId', { productId });
    if (tankId) qb.andWhere('tank.tank_id = :tankId', { tankId });

    const tanks = await qb.getMany();

    return tanks.map(tank => {
      const currentStock = Number(tank.current_stock ?? 0);
      const capacity = Number(tank.total_capacity ?? 1);
      const fillPercentage = (currentStock / capacity) * 100;
      const isLowStock = fillPercentage < 20;
      return {
        tankId: tank.tank_id,
        tankName: tank.tank_name,
        productId: tank.product?.product_id,
        productName: tank.product?.name,
        currentStock,
        capacity,
        fillPercentage: Math.round(fillPercentage * 100) / 100,
        isLowStock,
      };
    });
  }

  async getTankVariations(startDate: string, endDate: string, tankId?: number) {
    const qb = this.stockMovementRepository
      .createQueryBuilder('m')
      .select(`date_trunc('day', m.movement_timestamp AT TIME ZONE 'America/Lima')`, 'bucket')
      .addSelect('m.tank_id', 'tank_id')
      .addSelect(
        `SUM(CASE WHEN m.movement_type IN ('in','Entrada') THEN m.quantity ELSE -m.quantity END)`,
        'net_qty'
      );

    if (startDate && endDate) qb.where('DATE(m.movement_timestamp) BETWEEN :startDate AND :endDate', { startDate, endDate });
    else qb.where('m.movement_timestamp IS NOT NULL');

    qb.groupBy('bucket').addGroupBy('m.tank_id').orderBy('bucket', 'ASC');
    if (tankId) qb.andWhere('m.tank_id = :tankId', { tankId });

    const raw = await qb.getRawMany();
    const variations = raw.map(row => ({
      date: row.bucket instanceof Date ? row.bucket.toISOString().split('T')[0] : row.bucket,
      tank_id: row.tank_id,
      net_quantity: Number(row.net_qty || 0),
      bucket: row.bucket,
    }));

    return { variations, totalVariations: variations.length };
  }

  // ==================== FINANZAS / CRÉDITOS GENÉRICOS ====================
  async getOutstandingCredits(clientId?: number, status?: string, dueDateStart?: string, dueDateEnd?: string) {
    const qb = this.creditRepository
      .createQueryBuilder('c')
      .leftJoin('c.client', 'cl')
      .select('c.credit_id', 'credit_id')
      .addSelect('cl.client_id', 'client_id')
      .addSelect("CONCAT_WS(' ', cl.first_name, cl.last_name)", 'client_name')
      .addSelect('c.credit_amount - COALESCE(c.amount_paid, 0)', 'balance')
      .addSelect('c.due_date', 'due_date')
      .addSelect('c.credit_amount', 'total_amount')
      .addSelect('c.amount_paid', 'amount_paid');

    if (dueDateStart && dueDateEnd) qb.where('DATE(c.due_date) BETWEEN :dueDateStart AND :dueDateEnd', { dueDateStart, dueDateEnd });
    else qb.where('c.due_date IS NOT NULL');

    qb.andWhere('(c.credit_amount - COALESCE(c.amount_paid, 0)) > 0');
    if (clientId) qb.andWhere('cl.client_id = :clientId', { clientId });
    if (status === 'overdue') qb.andWhere('c.due_date < NOW()');
    qb.orderBy('c.due_date', 'ASC');

    const raw = await qb.getRawMany();

    const totalOutstanding = raw.reduce((sum, credit) => sum + Number(credit.balance || 0), 0);
    const partialPayments = raw.reduce((sum, credit) => sum + Number(credit.amount_paid || 0), 0);

    const now = new Date();
    const agingData = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const creditsDetails = raw.map(credit => {
      const dueDate = new Date(credit.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const balance = Number(credit.balance || 0);

      if (daysOverdue <= 30) agingData['0-30'] += balance;
      else if (daysOverdue <= 60) agingData['31-60'] += balance;
      else if (daysOverdue <= 90) agingData['61-90'] += balance;
      else agingData['90+'] += balance;

      return {
        credit_id: credit.credit_id,
        client_id: credit.client_id,
        client_name: credit.client_name,
        balance,
        due_date: credit.due_date,
        total_amount: Number(credit.total_amount || 0),
        amount_paid: Number(credit.amount_paid || 0),
        days_overdue: daysOverdue,
        is_overdue: daysOverdue > 0,
      };
    });

    return {
      totalOutstanding,
      partialPayments,
      agingData,
      creditsDetails,
      delinquentClients: creditsDetails.filter(c => c.is_overdue),
      creditsCount: creditsDetails.length,
    };
  }

  async getCollections(startDate: string, endDate: string, clientId?: number, paymentMethod?: string) {
    const qb = this.saleRepository.manager
      .createQueryBuilder()
      .select('p.payment_id', 'payment_id')
      .addSelect('p.amount', 'amount')
      .addSelect('p.payment_timestamp', 'payment_date')
      .addSelect('pm.name', 'payment_method')
      .addSelect('c.client_id', 'client_id')
      .addSelect("CONCAT_WS(' ', cl.first_name, cl.last_name)", 'client_name')
      .from('payments', 'p')
      .leftJoin('payment_methods', 'pm', 'p.payment_method_id = pm.payment_method_id')
      .leftJoin('credits', 'c', 'p.credit_id = c.credit_id')
      .leftJoin('clients', 'cl', 'c.client_id = cl.client_id');

    if (startDate && endDate) qb.where('DATE(p.payment_timestamp) BETWEEN :startDate AND :endDate', { startDate, endDate });
    else qb.where('p.payment_timestamp IS NOT NULL');

    qb.andWhere('p.credit_id IS NOT NULL');
    if (clientId) qb.andWhere('c.client_id = :clientId', { clientId });
    if (paymentMethod) qb.andWhere('pm.name = :method', { method: paymentMethod });

    const raw = await qb.getRawMany();
    const totalCollections = raw.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const collectionTrends: Record<string, number> = {};
    raw.forEach(p => {
      const date = p.payment_date ? new Date(p.payment_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      collectionTrends[date] = (collectionTrends[date] || 0) + Number(p.amount || 0);
    });

    return {
      totalCollections,
      collectionEfficiency: totalCollections > 0 ? 100 : 0,
      collectionTrends,
      collectionsDetails: raw.map((r: any) => ({
        payment_id: r.payment_id,
        client_id: r.client_id,
        client_name: r.client_name,
        amount: Number(r.amount || 0),
        payment_date: r.payment_date,
        payment_method: r.payment_method,
      })),
      collectionsCount: raw.length,
    };
  }

  // ==================== FINANZAS BÁSICAS ====================
  async getIncomeVsExpenses(
    startDate: string,
    endDate: string,
    expenseCategory?: string,
  ): Promise<{ totalIncome: number; totalExpenses: number; netProfit: number }> {
    // Ingresos por ventas
    const incomeRows = await this.dataSource.query(
      `
    SELECT COALESCE(SUM(COALESCE(s.final_amount, s.total_amount)), 0) AS income
    FROM sales s
    WHERE s.status IN ('completed','paid','finalized')
      AND DATE(s.sale_timestamp AT TIME ZONE '${this.tz}') BETWEEN $1 AND $2
    `,
      [startDate, endDate],
    );
    const totalIncome = Number(incomeRows?.[0]?.income ?? 0);

    // Gastos (opcional, solo si existe la tabla "expenses")
    let totalExpenses = 0;
    try {
      const existsResp = await this.dataSource.query(
        `SELECT to_regclass('public.expenses') AS exists`,
      );
      const exists = !!existsResp?.[0]?.exists;

      if (exists) {
        // Descubrir columnas disponibles
        const colsResp = await this.dataSource.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='expenses'
      `);
        const names = (colsResp || []).map((r: any) => r.column_name as string);

        const amountCol =
          names.includes('amount') ? 'amount' :
            names.includes('monto') ? 'monto' :
              names.includes('value') ? 'value' :
                null;

        const dateCol =
          names.includes('expense_date') ? 'expense_date' :
            names.includes('date') ? 'date' :
              names.includes('created_at') ? 'created_at' :
                names.includes('timestamp') ? 'timestamp' :
                  null;

        const categoryCol =
          names.includes('category') ? 'category' :
            names.includes('expense_category') ? 'expense_category' :
              names.includes('category_name') ? 'category_name' :
                null;

        if (amountCol && dateCol) {
          const params: any[] = [startDate, endDate];
          let whereCat = '';
          if (expenseCategory && categoryCol) {
            whereCat = ` AND e."${categoryCol}" = $3`;
            params.push(expenseCategory);
          }

          const expRows = await this.dataSource.query(
            `
          SELECT COALESCE(SUM(e."${amountCol}"),0) AS total
          FROM expenses e
          WHERE DATE(e."${dateCol}") BETWEEN $1 AND $2
          ${whereCat}
          `,
            params,
          );
          totalExpenses = Number(expRows?.[0]?.total ?? 0);
        }
      }
    } catch {
      // Silencioso: si falla algo de gastos, mantenemos 0
    }

    return {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
    };
  }

  async getCashFlow(
    startDate: string,
    endDate: string,
    paymentMethod?: string,
  ): Promise<{ cashReceived: number; transfersReceived: number }> {
    const methodFilterExact = paymentMethod
      ? ` AND LOWER(COALESCE(pm.method_name, pm.name, '')) = LOWER($3)`
      : '';

    const cashSales = await this.dataSource.query(
      `
    SELECT COALESCE(SUM(COALESCE(s.final_amount, s.total_amount)),0) AS amount
    FROM sales s
    LEFT JOIN payment_methods pm ON pm.payment_method_id = s.payment_method_id
    WHERE s.status IN ('completed','paid','finalized')
      AND DATE(s.sale_timestamp AT TIME ZONE '${this.tz}') BETWEEN $1 AND $2
      ${paymentMethod
        ? methodFilterExact
        : `AND LOWER(COALESCE(pm.method_name, pm.name, '')) LIKE '%efectivo%'`
      }
    `,
      paymentMethod ? [startDate, endDate, paymentMethod] : [startDate, endDate],
    );

    const cashPayments = await this.dataSource.query(
      `
    SELECT COALESCE(SUM(p.amount),0) AS amount
    FROM payments p
    LEFT JOIN payment_methods pm ON pm.payment_method_id = p.payment_method_id
    WHERE DATE(p.payment_timestamp AT TIME ZONE '${this.tz}') BETWEEN $1 AND $2
      ${paymentMethod
        ? methodFilterExact
        : `AND LOWER(COALESCE(pm.method_name, pm.name, '')) LIKE '%efectivo%'`
      }
    `,
      paymentMethod ? [startDate, endDate, paymentMethod] : [startDate, endDate],
    );

    const xferSales = await this.dataSource.query(
      `
    SELECT COALESCE(SUM(COALESCE(s.final_amount, s.total_amount)),0) AS amount
    FROM sales s
    LEFT JOIN payment_methods pm ON pm.payment_method_id = s.payment_method_id
    WHERE s.status IN ('completed','paid','finalized')
      AND DATE(s.sale_timestamp AT TIME ZONE '${this.tz}') BETWEEN $1 AND $2
      ${paymentMethod
        ? methodFilterExact
        : `AND (COALESCE(pm.method_name, pm.name, '') ILIKE ANY (ARRAY['%transfer%','%yape%','%plin%','%banco%','%deposit%']))`
      }
    `,
      paymentMethod ? [startDate, endDate, paymentMethod] : [startDate, endDate],
    );

    const xferPayments = await this.dataSource.query(
      `
    SELECT COALESCE(SUM(p.amount),0) AS amount
    FROM payments p
    LEFT JOIN payment_methods pm ON pm.payment_method_id = p.payment_method_id
    WHERE DATE(p.payment_timestamp AT TIME ZONE '${this.tz}') BETWEEN $1 AND $2
      ${paymentMethod
        ? methodFilterExact
        : `AND (COALESCE(pm.method_name, pm.name, '') ILIKE ANY (ARRAY['%transfer%','%yape%','%plin%','%banco%','%deposit%']))`
      }
    `,
      paymentMethod ? [startDate, endDate, paymentMethod] : [startDate, endDate],
    );

    const cashReceived =
      Number(cashSales?.[0]?.amount ?? 0) + Number(cashPayments?.[0]?.amount ?? 0);
    const transfersReceived =
      Number(xferSales?.[0]?.amount ?? 0) + Number(xferPayments?.[0]?.amount ?? 0);

    return { cashReceived, transfersReceived };
  }

  /* ============================================================
     NUEVO: Core + Facades de resúmenes 1..N usuarios / global
     ============================================================ */
  private async buildSummaryCore(userIds: number[] | null, range: DateRange, onlyCompleted = true): Promise<BaseSummary> {
    const { startDate, endDate } = range;

    const params: any[] = [startDate, endDate];
    let userFilter = '';
    if (Array.isArray(userIds) && userIds.length > 0) {
      params.push(userIds);
      userFilter = ` AND s.user_id = ANY($3) `;
    }

    const statusFilter = onlyCompleted ? ` AND s.status IN ${SOLD_STATUS} ` : '';

    // KPIs
    const kpisSql = `
      WITH bounds AS (
        SELECT
          (to_timestamp($1, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}')           AS ts_from,
          (to_timestamp($2, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}') + INTERVAL '1 day' AS ts_to_excl
      )
      SELECT
        COUNT(*)                                                             AS sales_count,
        COALESCE(SUM(${AMOUNT_EXPR}),0)                                        AS gross,
        0::numeric                                                           AS net,
        CASE WHEN COUNT(*)>0 THEN AVG(${AMOUNT_EXPR}) ELSE 0 END   AS avg_ticket,
        COALESCE(SUM(CASE WHEN c.credit_id IS NOT NULL THEN 1 ELSE 0 END),0) AS credits_count,
        COALESCE(SUM(CASE WHEN c.credit_id IS NOT NULL THEN c.credit_amount ELSE 0 END),0) AS credits_gross,
        0::numeric AS recovered_gross,
        COUNT(DISTINCT s.client_id)                                          AS unique_clients
      FROM sales s
      LEFT JOIN credits c ON c.sale_id = s.sale_id
      CROSS JOIN bounds b
      WHERE s.sale_timestamp >= b.ts_from
        AND s.sale_timestamp <  b.ts_to_excl
        ${statusFilter}
        ${userFilter}
    `;
    const krows = await this.dataSource.query(kpisSql, params);
    const k0 = krows?.[0] || {};
    const k: Kpis = {
      sales_count: Number(k0.sales_count || 0),
      gross: Number(k0.gross || 0),
      net: Number(k0.net || 0),
      avg_ticket: Number(k0.avg_ticket || 0),
      credits_count: Number(k0.credits_count || 0),
      credits_gross: Number(k0.credits_gross || 0),
      recovered_gross: 0,
      unique_clients: Number(k0.unique_clients || 0),
    };

    // Recovered
    const recParams = [...params];
    const recoveredSql = `
      WITH bounds AS (
        SELECT
          (to_timestamp($1, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}')           AS ts_from,
          (to_timestamp($2, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}') + INTERVAL '1 day' AS ts_to_excl
      )
      SELECT COALESCE(SUM(p.amount),0) AS amt
      FROM payments p
      LEFT JOIN credits c ON c.credit_id = p.credit_id
      LEFT JOIN sales   s ON s.sale_id   = c.sale_id
      CROSS JOIN bounds b
      WHERE p.payment_timestamp >= b.ts_from
        AND p.payment_timestamp <  b.ts_to_excl
        ${Array.isArray(userIds) && userIds.length > 0 ? ' AND (p.user_id = ANY($3) OR s.user_id = ANY($3)) ' : ''}
    `;
    const rrows = await this.dataSource.query(recoveredSql, recParams);
    k.recovered_gross = Number(rrows?.[0]?.amt || 0);

    // Por método de pago
    const pmParams = [...params];
    const pmSql = `
      WITH bounds AS (
        SELECT
          (to_timestamp($1, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}')           AS ts_from,
          (to_timestamp($2, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}') + INTERVAL '1 day' AS ts_to_excl
      ),
      base AS (
        SELECT
          ${normalizePaymentKeySql} AS pkey,
          COALESCE(pm.method_name, pm.name, 'Otro') AS label,
          ${AMOUNT_EXPR} AS amount
        FROM sales s
        LEFT JOIN payment_methods pm ON pm.payment_method_id = s.payment_method_id
        CROSS JOIN bounds b
        WHERE s.sale_timestamp >= b.ts_from AND s.sale_timestamp < b.ts_to_excl
          ${statusFilter}
          ${userFilter}
      )
      SELECT pkey, label,
             COUNT(*) AS count,
             COALESCE(SUM(amount),0) AS total_amount
      FROM base
      GROUP BY pkey, label
      ORDER BY total_amount DESC
    `;
    const pmRows = await this.dataSource.query(pmSql, pmParams);
    const byPayment: PaymentBreakdown[] = pmRows.map((r: any) => ({
      key: String(r.pkey) as PaymentKey,
      label: String(r.label || 'Otro'),
      count: Number(r.count || 0),
      total_amount: Number(r.total_amount || 0),
    }));

    // Por producto
    const prodParams = [...params];
    const prodSql = `
      WITH bounds AS (
        SELECT
          (to_timestamp($1, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}')           AS ts_from,
          (to_timestamp($2, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}') + INTERVAL '1 day' AS ts_to_excl
      )
      SELECT
        p.product_id,
        p.name AS product_name,
        COALESCE(SUM(sd.quantity),0) AS total_gallons,
        COALESCE(SUM(sd.subtotal),0) AS total_amount,
        COUNT(*) AS count
      FROM sales s
      JOIN sale_details sd ON sd.sale_id = s.sale_id
      JOIN products     p  ON p.product_id = sd.product_id
      CROSS JOIN bounds b
      WHERE s.sale_timestamp >= b.ts_from AND s.sale_timestamp < b.ts_to_excl
        ${statusFilter}
        ${userFilter}
      GROUP BY p.product_id, p.name
      ORDER BY total_amount DESC, product_name
    `;
    const pRows = await this.dataSource.query(prodSql, prodParams);
    const byProduct: ProductBreakdown[] = pRows.map((r: any) => ({
      product_id: Number(r.product_id),
      name: String(r.product_name || 'Producto'),
      total_amount: Number(r.total_amount || 0),
      total_gallons: Number(r.total_gallons || 0),
      count: Number(r.count || 0),
    }));

    // Créditos por cliente
    const crParams = [...params];
    const crSql = `
      WITH bounds AS (
        SELECT
          (to_timestamp($1, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}')           AS ts_from,
          (to_timestamp($2, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}') + INTERVAL '1 day' AS ts_to_excl
      )
      SELECT
        cl.client_id,
        CONCAT_WS(' ', cl.first_name, cl.last_name) AS client_name,
        COALESCE(SUM(c.credit_amount),0)           AS total_amount,
        COALESCE(SUM(sd.quantity),0)               AS total_gallons,
        COUNT(c.credit_id)                         AS count
      FROM credits c
      JOIN sales s        ON s.sale_id = c.sale_id
      LEFT JOIN clients cl ON cl.client_id = c.client_id
      LEFT JOIN sale_details sd ON sd.sale_id = s.sale_id
      CROSS JOIN bounds b
      WHERE s.sale_timestamp >= b.ts_from AND s.sale_timestamp < b.ts_to_excl
        ${statusFilter}
        ${userFilter}
      GROUP BY cl.client_id, client_name
      ORDER BY total_amount DESC, client_name
    `;
    const crRows = await this.dataSource.query(crSql, crParams);
    const byCreditClient: CreditBreakdown[] = crRows.map((r: any) => ({
      client_id: r.client_id != null ? Number(r.client_id) : null,
      client_name: r.client_name || 'Cliente',
      total_amount: Number(r.total_amount || 0),
      total_gallons: Number(r.total_gallons || 0),
      count: Number(r.count || 0),
    }));

    // Serie por día
    const tsParams = [...params];
    const tsSql = `
      WITH bounds AS (
        SELECT
          (to_timestamp($1, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}')           AS ts_from,
          (to_timestamp($2, 'YYYY-MM-DD') AT TIME ZONE '${this.tz}') + INTERVAL '1 day' AS ts_to_excl
      )
      SELECT
        to_char((date_trunc('day', s.sale_timestamp AT TIME ZONE '${this.tz}')),'YYYY-MM-DD') AS d,
        COUNT(*)                                                             AS count,
        COALESCE(SUM(${AMOUNT_EXPR}),0) AS gross
      FROM sales s
      CROSS JOIN bounds b
      WHERE s.sale_timestamp >= b.ts_from AND s.sale_timestamp < b.ts_to_excl
        ${statusFilter}
        ${userFilter}
      GROUP BY d
      ORDER BY d
    `;
    const tsRows = await this.dataSource.query(tsSql, tsParams);
    const timeseries: TimeseriesPoint[] = tsRows.map((r: any) => ({
      date: r.d,
      count: Number(r.count || 0),
      gross: Number(r.gross || 0),
    }));

    return {
      range,
      onlyCompleted,
      kpis: k,
      byPayment,
      byProduct,
      byCreditClient,
      timeseries,
    };
  }

  async getUserSummary(userId: number, startDate: string, endDate: string, onlyCompleted = true): Promise<UserSummary> {
    const base = await this.buildSummaryCore([Number(userId)], { startDate, endDate }, onlyCompleted);
    return { ...base, user_id: Number(userId) };
  }

  async getUsersSummary(userIds: number[], startDate: string, endDate: string, onlyCompleted = true): Promise<MultiUserSummary> {
    const uniq = Array.from(new Set((userIds || []).map(Number))).filter(n => Number.isFinite(n));
    const base = await this.buildSummaryCore(uniq, { startDate, endDate }, onlyCompleted);
    return { ...base, user_ids: uniq };
  }

  async getGlobalSummary(startDate: string, endDate: string, onlyCompleted = true): Promise<MultiUserSummary> {
    const base = await this.buildSummaryCore(null, { startDate, endDate }, onlyCompleted);
    return { ...base, user_ids: [] };
  }

  async getUserTimeseries(userId: number, startDate: string, endDate: string, onlyCompleted = true): Promise<TimeseriesPoint[]> {
    const rep = await this.getUserSummary(userId, startDate, endDate, onlyCompleted);
    return rep.timeseries;
  }
  async getUsersTimeseries(userIds: number[], startDate: string, endDate: string, onlyCompleted = true): Promise<TimeseriesPoint[]> {
    const rep = await this.getUsersSummary(userIds, startDate, endDate, onlyCompleted);
    return rep.timeseries;
  }
  async getGlobalTimeseries(startDate: string, endDate: string, onlyCompleted = true): Promise<TimeseriesPoint[]> {
    const rep = await this.getGlobalSummary(startDate, endDate, onlyCompleted);
    return rep.timeseries;
  }

  async exportSummaryToExcel(title: string, summary: BaseSummary): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    // KPIs
    const ws0 = wb.addWorksheet('KPIs');
    this.addExcelBrandHeader(
      ws0,
      title,
      `Período: ${summary.range.startDate} - ${summary.range.endDate} · Solo completadas: ${summary.onlyCompleted ? 'Sí' : 'No'}`,
      2
    );
    ws0.columns = [
      { header: 'KPI', key: 'k', width: 28 },
      { header: 'Valor', key: 'v', width: 18 },
    ];
    ws0.getRow(5).values = ['KPI', 'Valor'];
    ws0.addRow(['Ventas (#)', summary.kpis.sales_count]);
    ws0.addRow(['Bruto (S/)', summary.kpis.gross]);
    ws0.addRow(['Ticket promedio (S/)', summary.kpis.avg_ticket]);
    ws0.addRow(['Créditos (#)', summary.kpis.credits_count]);
    ws0.addRow(['Créditos (S/)', summary.kpis.credits_gross]);
    ws0.addRow(['Cobrado créditos (S/)', summary.kpis.recovered_gross]);
    ws0.addRow(['Clientes únicos', summary.kpis.unique_clients]);
    ws0.getColumn(2).numFmt = '#,##0.00';
    this.styleExcelTable(ws0, 5, 2);

    // Por método de pago
    const ws1 = wb.addWorksheet('Por método');
    this.addExcelBrandHeader(ws1, 'Por método de pago', '', 4);
    ws1.columns = [
      { header: 'Método', key: 'label', width: 24 },
      { header: 'Clave', key: 'key', width: 12 },
      { header: 'Ventas (#)', key: 'count', width: 12 },
      { header: 'Monto (S/)', key: 'total_amount', width: 16 },
    ];
    ws1.getRow(5).values = ['Método', 'Clave', 'Ventas (#)', 'Monto (S/)'];
    ws1.addRows(summary.byPayment.map(x => ({ ...x })));
    ws1.getColumn('total_amount').numFmt = '#,##0.00';
    this.styleExcelTable(ws1, 5, 4);

    // Por producto
    const ws2 = wb.addWorksheet('Por producto');
    this.addExcelBrandHeader(ws2, 'Por producto', '', 4);
    ws2.columns = [
      { header: 'Producto', key: 'name', width: 26 },
      { header: 'Galones', key: 'total_gallons', width: 14 },
      { header: 'Ventas (#)', key: 'count', width: 12 },
      { header: 'Monto (S/)', key: 'total_amount', width: 16 },
    ];
    ws2.getRow(5).values = ['Producto', 'Galones', 'Ventas (#)', 'Monto (S/)'];
    ws2.addRows(summary.byProduct.map(x => ({ ...x })));
    ws2.getColumn('total_gallons').numFmt = '#,##0.00';
    ws2.getColumn('total_amount').numFmt = '#,##0.00';
    this.styleExcelTable(ws2, 5, 4);

    // Créditos por cliente
    const ws3 = wb.addWorksheet('Créditos por cliente');
    this.addExcelBrandHeader(ws3, 'Créditos por cliente', '', 4);
    ws3.columns = [
      { header: 'Cliente', key: 'client_name', width: 28 },
      { header: 'Galones', key: 'total_gallons', width: 14 },
      { header: 'Créditos (#)', key: 'count', width: 14 },
      { header: 'Monto (S/)', key: 'total_amount', width: 16 },
    ];
    ws3.getRow(5).values = ['Cliente', 'Galones', 'Créditos (#)', 'Monto (S/)'];
    ws3.addRows(summary.byCreditClient.map(x => ({ ...x })));
    ws3.getColumn('total_gallons').numFmt = '#,##0.00';
    ws3.getColumn('total_amount').numFmt = '#,##0.00';
    this.styleExcelTable(ws3, 5, 4);

    // Serie
    const ws4 = wb.addWorksheet('Serie diaria');
    this.addExcelBrandHeader(ws4, 'Serie diaria', '', 3);
    ws4.columns = [
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Ventas (#)', key: 'count', width: 14 },
      { header: 'Bruto (S/)', key: 'gross', width: 16 },
    ];
    ws4.getRow(5).values = ['Fecha', 'Ventas (#)', 'Bruto (S/)'];
    ws4.addRows(summary.timeseries.map(x => ({ ...x })));
    ws4.getColumn('gross').numFmt = '#,##0.00';
    this.styleExcelTable(ws4, 5, 3);
    this.addExcelTotals(ws4, 5, [
      { key: 'Ventas (#)', label: 'Total Ventas' },
      { key: 'Bruto (S/)', label: 'Total Bruto', fmt: 'currency' },
    ]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportSummaryToPDF(
    title: string,
    summary: BaseSummary,
    landscape = true
  ): Promise<Buffer> {
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };
    const printer = new PdfPrinter(fonts);

    // Helpers
    const sectionTitle = (t: string) => ({
      text: t,
      style: 'sectionTitle',
      margin: [0, 16, 0, 6],
    });

    const makeTable = (cols: ColumnDef[], rows: any[]): any => {
      const body: TableCell[][] = [];
      // Header
      body.push(
        cols.map((c) => ({ text: c.header, bold: true, color: '#FFFFFF' })) as TableCell[]
      );
      // Rows
      for (const r of rows) {
        const row: TableCell[] = [];
        for (const c of cols) {
          let v: any = (r as any)[c.key];
          if (c.currency) v = Number(v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 });
          row.push({ text: v ?? '' });
        }
        body.push(row);
      }

      return {
        table: {
          headerRows: 1,
          widths: cols.map(() => 'auto'),
          body,
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? '#3B82F6' : rowIndex % 2 === 0 ? '#F3F4F6' : null,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#E5E7EB',
          vLineColor: () => '#E5E7EB',
        },
        margin: [0, 2, 0, 0],
      };
    };

    // Secciones
    const k = summary.kpis;
    const headerSubtitle = `Período: ${summary.range.startDate} - ${summary.range.endDate} · Solo completadas: ${summary.onlyCompleted ? 'Sí' : 'No'
      }`;

    const content: any[] = [
      // Encabezado
      {
        margin: [36, 0, 36, 8],
        columns: [{ text: title, style: 'title', alignment: 'center' }],
      },
      {
        text: headerSubtitle,
        style: 'subtitle',
        alignment: 'center',
        margin: [0, 0, 0, 8],
      },

      // KPIs (grid 2 columnas)
      sectionTitle('KPIs'),
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: `Ventas (#): ${k.sales_count}`, style: 'kpi' },
              { text: `Bruto (S/): ${k.gross.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, style: 'kpi' },
              { text: `Ticket promedio (S/): ${k.avg_ticket.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, style: 'kpi' },
              { text: `Clientes únicos: ${k.unique_clients}`, style: 'kpi' },
            ],
          },
          {
            width: '*',
            stack: [
              { text: `Créditos (#): ${k.credits_count}`, style: 'kpi' },
              { text: `Créditos (S/): ${k.credits_gross.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, style: 'kpi' },
              { text: `Cobrado créditos (S/): ${k.recovered_gross.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, style: 'kpi' },
            ],
          },
        ],
        columnGap: 24,
        margin: [0, 2, 0, 10],
      },

      // Por método de pago
      sectionTitle('Por método de pago'),
      makeTable(
        [
          { header: 'Método', key: 'label' },
          { header: 'Clave', key: 'key' },
          { header: 'Ventas (#)', key: 'count' },
          { header: 'Monto (S/)', key: 'total_amount', currency: true },
        ],
        summary.byPayment
      ),

      // Por producto
      sectionTitle('Por producto'),
      makeTable(
        [
          { header: 'Producto', key: 'name' },
          { header: 'Galones', key: 'total_gallons' },
          { header: 'Ventas (#)', key: 'count' },
          { header: 'Monto (S/)', key: 'total_amount', currency: true },
        ],
        summary.byProduct
      ),

      // Créditos por cliente
      sectionTitle('Créditos por cliente'),
      makeTable(
        [
          { header: 'Cliente', key: 'client_name' },
          { header: 'Galones', key: 'total_gallons' },
          { header: 'Créditos (#)', key: 'count' },
          { header: 'Monto (S/)', key: 'total_amount', currency: true },
        ],
        summary.byCreditClient
      ),

      // Serie diaria
      sectionTitle('Serie diaria'),
      makeTable(
        [
          { header: 'Fecha', key: 'date' },
          { header: 'Ventas (#)', key: 'count' },
          { header: 'Bruto (S/)', key: 'gross', currency: true },
        ],
        summary.timeseries
      ),
    ];

    const dd: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: landscape ? 'landscape' : 'portrait',
      pageMargins: [36, 48, 36, 42],
      header: undefined,
      footer: (currentPage, pageCount) => ({
        margin: [36, 0, 36, 24],
        columns: [
          {
            text: `Generado: ${new Date().toLocaleString('es-PE', { timeZone: this.tz })}`,
            style: 'foot',
          },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', style: 'foot' },
        ],
      }),
      content,
      styles: {
        title: { fontSize: 16, bold: true, color: '#111111' },
        subtitle: { fontSize: 10, italics: true, color: '#374151' },
        sectionTitle: { fontSize: 12, bold: true, color: '#111827' },
        kpi: { fontSize: 10, margin: [0, 2, 0, 0] },
        foot: { fontSize: 9, color: '#6B7280' },
      },
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
    };

    return await new Promise<Buffer>((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(dd);
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (c) => chunks.push(c));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }



}

