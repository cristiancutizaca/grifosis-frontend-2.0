import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { DataSource } from 'typeorm';
import { ReportsService } from './reports.service';
import { SalesByPeriodQueryDto } from '../sales/dto/sales-by-period.dto';
import { GetSalesByEmployeeDto } from './dto/get-sales-by-employee.dto';
import { GetSalesByProductDto } from './dto/get-sales-by-product.dto';
import { GetInventoryMovementsDto } from './dto/get-inventory-movements.dto';
import { GetCurrentStockDto } from './dto/get-current-stock.dto';
import { GetCashFlowDto } from './dto/get-cash-flow.dto';
import { GetIncomeVsExpensesDto } from './dto/get-income-vs-expenses.dto';
import { GetOutstandingCreditsDto } from './dto/get-outstanding-credits.dto';
import { GetCollectionsDto } from './dto/get-collections.dto';
import { GetDetailedEmployeeReportDto } from './dto/report-dtos';

@Controller('reports')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly ds: DataSource,
  ) {}

  // ========================= Helpers =========================
  private fmt(q: any) {
    return String(q?.format ?? 'json').toLowerCase();
  }
  private onlyCompleted(q: any) {
    return String(q?.onlyCompleted ?? 'true').toLowerCase() !== 'false';
  }
  private requireDates(q: any) {
    if (!q?.startDate || !q?.endDate) {
      throw new BadRequestException('Debe indicar startDate y endDate (YYYY-MM-DD).');
    }
  }
  private parseUserIds(raw: string | string[]) {
    const v = Array.isArray(raw) ? raw.join(',') : String(raw ?? '');
    const ids = v
      .split(',')
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    return ids;
  }

  private sendJSON(res: Response, body: unknown) {
    res.json(body);
  }
  private sendExcel(res: Response, buf: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length.toString());
    res.setHeader('Cache-Control', 'no-cache');
    res.end(buf);
  }
  private sendPDF(res: Response, buf: Buffer, filename: string, inline = false) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(buf);
  }
  private handleError(res: Response, where: string, error: any, fallbackMsg: string) {
    // eslint-disable-next-line no-console
    console.error(`Error en ${where}:`, error);
    const status =
      error instanceof NotFoundException || error instanceof BadRequestException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    res.status(status).json({ message: fallbackMsg, details: error?.message });
  }

  // ==================== NUEVO: GALONES VENDIDOS (día|mes|año) ====================
  @Get('sales/gallons')
  async getGallonsSold(
    @Res() res: Response,
    @Query('scope') scope: 'day' | 'month' | 'year' = 'day',
    @Query('at') at?: string,
  ) {
    try {
      const unit = scope === 'month' ? 'month' : scope === 'year' ? 'year' : 'day';
      const when = at ? new Date(at) : new Date();
      const rows = await this.ds.query(
        `
        SELECT COALESCE(SUM(s.total_amount / NULLIF(p.unit_price, 0)), 0) AS gallons
        FROM sales s
        JOIN nozzles  n ON n.nozzle_id  = s.nozzle_id
        JOIN products p ON p.product_id = n.product_id
        -- ✅ CORRECCIÓN 4: Se usan los estados de venta consistentes.
        WHERE s.status IN ('completed','paid','finalized')
          AND s.sale_timestamp >= date_trunc($1, $2::timestamp)
          AND s.sale_timestamp <  (date_trunc($1, $2::timestamp) + ('1 ' || $1)::interval)
        `,
        [unit, when.toISOString()],
      );
      const gallons = Number(rows?.[0]?.gallons ?? 0);
      this.sendJSON(res, { scope: unit, at: when.toISOString(), gallons: Number(gallons.toFixed(2)) });
    } catch (error) {
      this.handleError(res, 'sales/gallons', error, 'Error al obtener los galones vendidos.');
    }
  }

  // ==================== VENTAS POR TURNO ====================
  // ✅ CORRECCIÓN 1: Método completo actualizado para coincidir con la firma del servicio y las keys correctas.
  @Get('sales/by-shift')
  async getSalesByShift(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') formatRaw?: string,
    @Res() res?: Response,
  ) {
    try {
      if (!startDate || !endDate) {
        throw new BadRequestException('Debe indicar startDate y endDate (YYYY-MM-DD).');
      }

      // La lógica de `onlyCompleted` ahora está en el service, no se pasa desde aquí.
      const rows = await this.reportsService.getSalesByShift(startDate, endDate);
      const title = `Ventas por turno (${startDate} a ${endDate})`;
      const fmt = String(formatRaw ?? 'json').toLowerCase();

      // Las keys `orders` y `total` ahora coinciden con lo que devuelve el service.
      const cols = [
        { header: 'Turno', key: 'shift_name', width: 28 },
        { header: 'Pedidos', key: 'orders', width: 12 },
        { header: 'Total', key: 'total', currency: true, width: 16 },
      ] as const;

      if (fmt === 'excel') {
        const buf = await this.reportsService.exportAggregationToExcel({
          rows,
          title,
          columns: cols as any,
        });
        return this.sendExcel(res!, buf, `ventas_turno_${startDate}_${endDate}.xlsx`);
      }
      if (fmt === 'pdf') {
        const pdf = await this.reportsService.exportAggregationToPDF({
          rows,
          title,
          columns: cols as any,
          landscape: true,
        });
        return this.sendPDF(res!, pdf, `ventas_turno_${startDate}_${endDate}.pdf`);
      }

      return this.sendJSON(res!, rows);
    } catch (error) {
      this.handleError(res!, 'sales/by-shift', error, 'Error al generar el reporte por turno.');
    }
  }

  // ==================== RESÚMENES 1..N..GLOBAL ====================
  @Get('summary/user')
  async getSummaryUser(@Query() q: any, @Res() res: Response) {
    try {
      const userId = Number(String(q.userId ?? q.userid ?? '').trim());
      if (!userId || Number.isNaN(userId)) throw new BadRequestException('userId inválido.');
      this.requireDates(q);

      const summary = await this.reportsService.getUserSummary(userId, q.startDate, q.endDate, this.onlyCompleted(q));
      const title = `Resumen usuario ${userId} (${q.startDate} a ${q.endDate})`;
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportSummaryToExcel(title, summary),
          `summary_user_${userId}_${q.startDate}_${q.endDate}.xlsx`,
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportSummaryToPDF(title, summary, true),
          `summary_user_${userId}_${q.startDate}_${q.endDate}.pdf`,
        );
      return this.sendJSON(res, summary);
    } catch (error) {
      this.handleError(res, 'summary/user', error, 'Error al generar resumen de usuario.');
    }
  }

  @Get('summary/users')
  async getSummaryUsers(@Query() q: any, @Res() res: Response) {
    try {
      const ids = this.parseUserIds(q.userIds ?? q.users ?? '');
      if (!ids.length) throw new BadRequestException('Debe indicar userIds separados por coma.');
      this.requireDates(q);

      const summary = await this.reportsService.getUsersSummary(ids, q.startDate, q.endDate, this.onlyCompleted(q));
      const title = `Resumen usuarios [${ids.join(',')}] (${q.startDate} a ${q.endDate})`;
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportSummaryToExcel(title, summary),
          `summary_users_${q.startDate}_${q.endDate}.xlsx`,
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportSummaryToPDF(title, summary, true),
          `summary_users_${q.startDate}_${q.endDate}.pdf`,
        );
      return this.sendJSON(res, summary);
    } catch (error) {
      this.handleError(res, 'summary/users', error, 'Error al generar resumen de varios usuarios.');
    }
  }

  @Get('summary/global')
  async getSummaryGlobal(@Query() q: any, @Res() res: Response) {
    try {
      this.requireDates(q);
      const summary = await this.reportsService.getGlobalSummary(q.startDate, q.endDate, this.onlyCompleted(q));
      const title = `Resumen global (${q.startDate} a ${q.endDate})`;
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportSummaryToExcel(title, summary),
          `summary_global_${q.startDate}_${q.endDate}.xlsx`,
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportSummaryToPDF(title, summary, true),
          `summary_global_${q.startDate}_${q.endDate}.pdf`,
        );
      return this.sendJSON(res, summary);
    } catch (error) {
      this.handleError(res, 'summary/global', error, 'Error al generar resumen global.');
    }
  }

  // ==================== SERIES (1 / N / GLOBAL) ====================
  @Get('timeseries/user')
  async getTimeseriesUser(@Query() q: any, @Res() res: Response) {
    try {
      const userId = Number(String(q.userId ?? '').trim());
      if (!userId || Number.isNaN(userId)) throw new BadRequestException('userId inválido.');
      this.requireDates(q);

      const data = await this.reportsService.getUserTimeseries(userId, q.startDate, q.endDate, this.onlyCompleted(q));
      const format = this.fmt(q);
      const title = `Serie diaria usuario ${userId} (${q.startDate} a ${q.endDate})`;

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({
            rows: data,
            title,
            columns: [
              { header: 'Fecha', key: 'date', width: 14 },
              { header: 'Ventas (#)', key: 'count', width: 12 },
              { header: 'Bruto (S/)', key: 'gross', currency: true, width: 16 },
            ],
          }),
          `ts_user_${userId}_${q.startDate}_${q.endDate}.xlsx`,
        );

      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({
            rows: data,
            title,
            columns: [
              { header: 'Fecha', key: 'date', width: 14 },
              { header: 'Ventas (#)', key: 'count', width: 12 },
              { header: 'Bruto (S/)', key: 'gross', width: 16 },
            ],
          }),
          `ts_user_${userId}_${q.startDate}_${q.endDate}.pdf`,
        );

      return this.sendJSON(res, data);
    } catch (error) {
      this.handleError(res, 'timeseries/user', error, 'Error al obtener serie de usuario.');
    }
  }

  @Get('timeseries/users')
  async getTimeseriesUsers(@Query() q: any, @Res() res: Response) {
    try {
      const ids = this.parseUserIds(q.userIds ?? '');
      if (!ids.length) throw new BadRequestException('Debe indicar userIds separados por coma.');
      this.requireDates(q);

      const data = await this.reportsService.getUsersTimeseries(ids, q.startDate, q.endDate, this.onlyCompleted(q));
      const format = this.fmt(q);
      const title = `Serie diaria usuarios [${ids.join(',')}] (${q.startDate} a ${q.endDate})`;

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({
            rows: data,
            title,
            columns: [
              { header: 'Fecha', key: 'date', width: 14 },
              { header: 'Ventas (#)', key: 'count', width: 12 },
              { header: 'Bruto (S/)', key: 'gross', currency: true, width: 16 },
            ],
          }),
          `ts_users_${q.startDate}_${q.endDate}.xlsx`,
        );

      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({
            rows: data,
            title,
            columns: [
              { header: 'Fecha', key: 'date', width: 14 },
              { header: 'Ventas (#)', key: 'count', width: 12 },
              { header: 'Bruto (S/)', key: 'gross', width: 16 },
            ],
          }),
          `ts_users_${q.startDate}_${q.endDate}.pdf`,
        );

      return this.sendJSON(res, data);
    } catch (error) {
      this.handleError(res, 'timeseries/users', error, 'Error al obtener serie de varios usuarios.');
    }
  }

  @Get('timeseries/global')
  async getTimeseriesGlobal(@Query() q: any, @Res() res: Response) {
    try {
      this.requireDates(q);
      const data = await this.reportsService.getGlobalTimeseries(q.startDate, q.endDate, this.onlyCompleted(q));
      const format = this.fmt(q);
      const title = `Serie diaria global (${q.startDate} a ${q.endDate})`;

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({
            rows: data,
            title,
            columns: [
              { header: 'Fecha', key: 'date', width: 14 },
              { header: 'Ventas (#)', key: 'count', width: 12 },
              { header: 'Bruto (S/)', key: 'gross', currency: true, width: 16 },
            ],
          }),
          `ts_global_${q.startDate}_${q.endDate}.xlsx`,
        );

      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({
            rows: data,
            title,
            columns: [
              { header: 'Fecha', key: 'date', width: 14 },
              { header: 'Ventas (#)', key: 'count', width: 12 },
              { header: 'Bruto (S/)', key: 'gross', width: 16 },
            ],
          }),
          `ts_global_${q.startDate}_${q.endDate}.pdf`,
        );

      return this.sendJSON(res, data);
    } catch (error) {
      this.handleError(res, 'timeseries/global', error, 'Error al obtener serie global.');
    }
  }

  // ==================== REPORTE DETALLADO POR USUARIO (CON ITEMS) ====================
  @Get('user/detailed')
  async getUserDetailed(@Query() q: any, @Res() res: Response) {
    try {
      const userId = Number(String(q.userId ?? q.userid ?? '').trim());
      if (!userId || Number.isNaN(userId) || userId <= 0) throw new BadRequestException('No se recibió un userId válido.');
      this.requireDates(q);
      const { startDate, endDate } = q;
      const rows = await this.reportsService.getSalesByUserDetailed(userId, startDate, endDate);
      const format = this.fmt(q);

      if (format === 'excel') {
        const buf = await this.reportsService.exportUserDetailedToExcel({
          userId,
          userName: q.userName ?? `usuario_${userId}`,
          startDate,
          endDate,
          rows,
        });
        return this.sendExcel(res, buf, `reporte_usuario_${userId}_${startDate}_a_${endDate}.xlsx`);
      }

      if (format === 'pdf') {
        const flat = rows.flatMap((sale) =>
          (sale.items?.length ? sale.items : [{ product_name: '(sin items)', quantity: 0, unit_price: 0, subtotal: 0 }]).map(
            (it, idx) => ({
              sale_id: idx === 0 ? sale.sale_id : '',
              sale_timestamp: idx === 0 ? sale.sale_timestamp : '',
              payment_method: idx === 0 ? (sale.payment_method ?? '') : '',
              product_name: it.product_name ?? '',
              quantity: it.quantity ?? 0,
              unit_price: it.unit_price ?? 0,
              subtotal: it.subtotal ?? 0,
              total_amount: idx === 0 ? (sale.total_amount ?? 0) : '',
              client: idx === 0 ? (sale.client_name ?? '') : '',
            }),
          ),
        );
        const pdf = await this.reportsService.exportAggregationToPDF({
          rows: flat,
          title: `Ventas por usuario (${userId}) ${startDate} - ${endDate}`,
          columns: [
            { header: 'Venta', key: 'sale_id' },
            { header: 'Fecha', key: 'sale_timestamp' },
            { header: 'Pago', key: 'payment_method' },
            { header: 'Producto', key: 'product_name' },
            { header: 'Cantidad', key: 'quantity' },
            { header: 'Precio Unit.', key: 'unit_price', currency: true },
            { header: 'Subtotal', key: 'subtotal', currency: true },
            { header: 'Total Venta', key: 'total_amount', currency: true },
            { header: 'Cliente', key: 'client' },
          ],
          landscape: true,
        });
        return this.sendPDF(res, pdf, `reporte_usuario_${userId}_${startDate}_a_${endDate}.pdf`, true);
      }

      return this.sendJSON(res, { userId, startDate, endDate, count: rows.length, sales: rows });
    } catch (error) {
      this.handleError(res, 'user/detailed', error, 'Error al generar el reporte detallado por usuario.');
    }
  }

  // ==================== CRÉDITOS / PAGOS por USUARIO ====================
  @Get('credits/by-user')
  async getCreditsByUser(@Query() q: any, @Res() res: Response) {
    try {
      const userId = Number(String(q.userId ?? '').trim());
      if (!userId || Number.isNaN(userId)) throw new BadRequestException('userId inválido.');
      this.requireDates(q);
      const rows = await this.reportsService.getCreditsByUser(userId, q.startDate, q.endDate);
      const title = `Créditos por usuario (${userId}) ${q.startDate} - ${q.endDate}`;
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({
            rows,
            title,
            columns: [
              { header: 'Crédito', key: 'credit_id', width: 12 },
              { header: 'Venta', key: 'sale_id', width: 10 },
              { header: 'Cliente ID', key: 'client_id', width: 12 },
              { header: 'Cliente', key: 'client_name', width: 26 },
              { header: 'Monto Crédito', key: 'credit_amount', currency: true, width: 16 },
              { header: 'Pagado', key: 'amount_paid', currency: true, width: 14 },
              { header: 'Saldo', key: 'remaining_balance', currency: true, width: 14 },
              { header: 'Vencimiento', key: 'due_date', width: 14 },
              { header: 'Fecha Venta', key: 'sale_timestamp', width: 20 },
            ],
          }),
          `creditos_usuario_${userId}_${q.startDate}_${q.endDate}.xlsx`,
        );

      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({
            rows,
            title,
            columns: [
              { header: 'Crédito', key: 'credit_id' },
              { header: 'Venta', key: 'sale_id' },
              { header: 'Cliente', key: 'client_name' },
              { header: 'Monto', key: 'credit_amount', currency: true },
              { header: 'Pagado', key: 'amount_paid', currency: true },
              { header: 'Saldo', key: 'remaining_balance', currency: true },
              { header: 'Vence', key: 'due_date' },
              { header: 'Fecha Venta', key: 'sale_timestamp' },
            ],
            landscape: true,
          }),
          `creditos_usuario_${userId}_${q.startDate}_${q.endDate}.pdf`,
        );

      return this.sendJSON(res, { userId, startDate: q.startDate, endDate: q.endDate, count: rows.length, credits: rows });
    } catch (error) {
      this.handleError(res, 'credits/by-user', error, 'Error al obtener créditos por usuario.');
    }
  }

  @Get('credits/payments-by-user')
  async getCreditPaymentsByUser(@Query() q: any, @Res() res: Response) {
    try {
      const userId = Number(String(q.userId ?? '').trim());
      if (!userId || Number.isNaN(userId)) throw new BadRequestException('userId inválido.');
      this.requireDates(q);
      const rows = await this.reportsService.getCreditPaymentsByUser(userId, q.startDate, q.endDate);
      const title = `Pagos de créditos por usuario (${userId}) ${q.startDate} - ${q.endDate}`;
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({
            rows,
            title,
            columns: [
              { header: 'Pago', key: 'payment_id', width: 12 },
              { header: 'Crédito', key: 'credit_id', width: 12 },
              { header: 'Venta', key: 'sale_id', width: 10 },
              { header: 'Cliente ID', key: 'client_id', width: 12 },
              { header: 'Cliente', key: 'client_name', width: 26 },
              { header: 'Monto', key: 'amount', currency: true, width: 14 },
              { header: 'Fecha Pago', key: 'payment_timestamp', width: 20 },
              { header: 'Método', key: 'payment_method', width: 18 },
            ],
          }),
          `pagos_creditos_usuario_${userId}_${q.startDate}_${q.endDate}.xlsx`,
        );

      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({
            rows,
            title,
            columns: [
              { header: 'Pago', key: 'payment_id' },
              { header: 'Crédito', key: 'credit_id' },
              { header: 'Venta', key: 'sale_id' },
              { header: 'Cliente', key: 'client_name' },
              { header: 'Monto', key: 'amount', currency: true },
              { header: 'Fecha Pago', key: 'payment_timestamp' },
              { header: 'Método', key: 'payment_method' },
            ],
            landscape: true,
          }),
          `pagos_creditos_usuario_${userId}_${q.startDate}_${q.endDate}.pdf`,
        );

      return this.sendJSON(res, { userId, startDate: q.startDate, endDate: q.endDate, count: rows.length, payments: rows });
    } catch (error) {
      this.handleError(res, 'credits/payments-by-user', error, 'Error al obtener pagos de créditos por usuario.');
    }
  }

  // ==================== INVENTARIO UI (VIEW) POR USUARIO ====================
  @Get('inventory/movements-ui')
  async getInventoryMovementsUI(@Query() q: any, @Res() res: Response) {
    try {
      const userId = Number(String(q.userId ?? '').trim());
      if (!userId || Number.isNaN(userId)) throw new BadRequestException('userId inválido.');
      this.requireDates(q);

      const rows = await this.reportsService.getInventoryMovementsUI(userId, q.startDate, q.endDate);
      const title = `Movimientos de Inventario (UI) - Usuario ${userId} (${q.startDate} a ${q.endDate})`;
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({
            rows,
            title,
            columns: [
              { header: 'Fecha/Hora', key: 'fecha_hora', width: 22 },
              { header: 'Producto', key: 'producto', width: 26 },
              { header: 'Tanque', key: 'tanque', width: 18 },
              { header: 'Tipo', key: 'tipo', width: 12 },
              { header: 'Cantidad', key: 'cantidad', width: 14 },
              { header: 'Motivo', key: 'motivo', width: 28 },
            ],
          }),
          `movimientos_inventario_ui_user_${userId}_${q.startDate}_${q.endDate}.xlsx`,
        );

      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({
            rows,
            title,
            columns: [
              { header: 'Fecha/Hora', key: 'fecha_hora' },
              { header: 'Producto', key: 'producto' },
              { header: 'Tanque', key: 'tanque' },
              { header: 'Tipo', key: 'tipo' },
              { header: 'Cantidad', key: 'cantidad' },
              { header: 'Motivo', key: 'motivo' },
            ],
            landscape: true,
          }),
          `movimientos_inventario_ui_user_${userId}_${q.startDate}_${q.endDate}.pdf`,
        );

      return this.sendJSON(res, { userId, startDate: q.startDate, endDate: q.endDate, count: rows.length, rows });
    } catch (error) {
      this.handleError(res, 'inventory/movements-ui', error, 'Error al obtener movimientos de inventario (UI) por usuario.');
    }
  }

  // ==================== INVENTARIO UI (SQL) VARIOS USUARIOS ====================
  @Get('inventory/movements-ui/by-users')
  async getInventoryMovementsByUsersUI(@Query() q: any, @Res() res: Response) {
    try {
      const userIds = this.parseUserIds(q.userIds ?? q.users ?? '');
      if (!userIds.length) throw new BadRequestException('Debe indicar userIds separados por coma.');
      this.requireDates(q);

      const perUser = await Promise.all(
        userIds.map(async (uid) => ({
          userId: uid,
          rows: await this.reportsService.getInventoryMovementsByUserUI(uid, q.startDate, q.endDate),
        })),
      );

      const format = this.fmt(q);
      // ✅ CORRECCIÓN 2: Se simplifica la creación de `flat`.
      const flat = perUser.flatMap((u) => u.rows);
      const title = `Movimientos de Inventario (UI) - Usuarios [${userIds.join(',')}] (${q.startDate} a ${q.endDate})`;

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({
            rows: flat,
            title,
            columns: [
              { header: 'Usuario', key: 'user_id', width: 10 },
              { header: 'Fecha/Hora', key: 'fecha_hora', width: 22 },
              { header: 'Producto', key: 'producto', width: 26 },
              { header: 'Tanque', key: 'tanque', width: 18 },
              { header: 'Tipo', key: 'tipo', width: 12 },
              { header: 'Cantidad', key: 'cantidad', width: 14 },
              { header: 'Motivo', key: 'motivo', width: 28 },
            ],
          }),
          `movimientos_inventario_ui_users_${q.startDate}_${q.endDate}.xlsx`,
        );

      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({
            rows: flat,
            title,
            columns: [
              { header: 'Usuario', key: 'user_id' },
              { header: 'Fecha/Hora', key: 'fecha_hora' },
              { header: 'Producto', key: 'producto' },
              { header: 'Tanque', key: 'tanque' },
              { header: 'Tipo', key: 'tipo' },
              { header: 'Cantidad', key: 'cantidad' },
              { header: 'Motivo', key: 'motivo' },
            ],
            landscape: true,
          }),
          `movimientos_inventario_ui_users_${q.startDate}_${q.endDate}.pdf`,
        );

      return this.sendJSON(res, {
        userIds,
        startDate: q.startDate,
        endDate: q.endDate,
        totalUsers: userIds.length,
        totals: perUser.map((u) => ({ userId: u.userId, count: u.rows.length })),
        data: perUser.map((u) => ({ userId: u.userId, rows: u.rows })),
      });
    } catch (error) {
      this.handleError(res, 'inventory/movements-ui/by-users', error, 'Error al obtener movimientos (UI) por varios usuarios.');
    }
  }

  @Get('inventory/movements-ui/summary')
  async getInventoryMovementsByUserUISummary(@Query() q: any, @Res() res: Response) {
    try {
      const userId = Number(String(q.userId ?? '').trim());
      if (!userId || Number.isNaN(userId)) throw new BadRequestException('userId inválido.');
      this.requireDates(q);

      const detalle = await this.reportsService.getInventoryMovementsByUserUI(userId, q.startDate, q.endDate);
      const rows = Object.values(
        detalle.reduce((acc: any, it: any) => {
          const tipo = (it.tipo ?? 'Ajuste') as 'Entrada' | 'Salida' | 'Ajuste';
          acc[tipo] ??= { tipo, movimientos: 0, total_cantidad: 0 };
          acc[tipo].movimientos += 1;
          acc[tipo].total_cantidad += Number(it.cantidad || 0);
          return acc;
        }, {}),
      );

      const title = `Resumen Mov. Inventario - Usuario ${userId} (${q.startDate} a ${q.endDate})`;
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({
            rows,
            title,
            columns: [
              { header: 'Tipo', key: 'tipo', width: 14 },
              { header: 'Movimientos', key: 'movimientos', width: 14 },
              { header: 'Total Cantidad', key: 'total_cantidad', width: 16 },
            ],
          }),
          `movimientos_inventario_resumen_${userId}_${q.startDate}_${q.endDate}.xlsx`,
        );

      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({
            rows,
            title,
            columns: [
              { header: 'Tipo', key: 'tipo' },
              { header: 'Movimientos', key: 'movimientos' },
              { header: 'Total Cantidad', key: 'total_cantidad' },
            ],
          }),
          `movimientos_inventario_resumen_${userId}_${q.startDate}_${q.endDate}.pdf`,
        );

      return this.sendJSON(res, { userId, startDate: q.startDate, endDate: q.endDate, rows });
    } catch (error) {
      this.handleError(res, 'inventory/movements-ui/summary', error, 'Error al obtener resumen de movimientos (UI) por usuario.');
    }
  }

  // ==================== REPORTE DETALLADO POR EMPLEADO ====================
  @Get('employee/detailed')
  async getDetailedEmployeeReport(@Query() q: GetDetailedEmployeeReportDto, @Res() res: Response) {
    try {
      if (!q.employeeId) throw new BadRequestException('Debe proporcionar un employeeId para este reporte.');

      const employeeIdNum = parseInt(q.employeeId, 10);
      const employee = await this.reportsService.findEmployeeById(employeeIdNum);
      if (!employee) throw new NotFoundException(`Empleado con ID ${q.employeeId} no encontrado.`);

      const reportData = await this.reportsService.getDetailedEmployeeReport(
        employeeIdNum,
        q.startDate ?? '',
        q.endDate ?? '',
      );

      if (q.format === 'excel') {
        const buf = await this.reportsService.exportDetailedEmployeeReportToExcel({
          reportData,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          startDate: q.startDate ?? 'inicio',
          endDate: q.endDate ?? 'fin',
        });
        return this.sendExcel(
          res,
          buf,
          `reporte_detallado_${q.employeeId}_${q.startDate ?? 'inicio'}_${q.endDate ?? 'fin'}.xlsx`,
        );
      }

      return this.sendJSON(res, reportData);
    } catch (error) {
      this.handleError(res, 'employee/detailed', error, 'Error al generar el reporte detallado por empleado.');
    }
  }

  // ==================== REPORTES DE VENTAS ====================
  @Get('sales/by-period')
  async getSalesByPeriod(@Query() q: SalesByPeriodQueryDto, @Res() res: Response) {
    try {
      const rows = await this.reportsService.getSalesAggregated(q);
      const title = `Ventas por ${q.granularity ?? 'day'} (${q.startDate ?? ''} a ${q.endDate ?? ''})`;
      const cols = this.reportsService.columnsForGranularity(q.granularity ?? 'day');
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({ rows: rows as any[], title, columns: cols }),
          `ventas_${q.granularity ?? 'day'}_${q.startDate}_${q.endDate}.xlsx`,
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({
            rows: rows as any[],
            title,
            columns: cols,
            landscape: q.granularity === 'shift',
          }),
          `ventas_${q.granularity ?? 'day'}_${q.startDate}_${q.endDate}.pdf`,
        );
      return this.sendJSON(res, rows);
    } catch (error) {
      this.handleError(res, 'sales/by-period', error, 'Error al generar el reporte de ventas.');
    }
  }

  @Get('sales/by-employee')
  async getSalesByEmployee(@Query() q: GetSalesByEmployeeDto, @Res() res: Response) {
    try {
      const result = await this.reportsService.getSalesSummaryByEmployee(undefined, q.startDate, q.endDate);
      const rows = result.rankingData;
      const title = 'Ventas por empleado';
      const cols = [
        { header: 'Empleado', key: 'name', width: 25 },
        { header: 'Pedidos', key: 'orders', width: 12 },
        { header: 'Total', key: 'total', currency: true, width: 15 },
      ];
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({ rows, title, columns: cols }),
          'ventas_por_empleado.xlsx',
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({ rows, title, columns: cols }),
          'ventas_por_empleado.pdf',
        );
      return this.sendJSON(res, result);
    } catch (error) {
      this.handleError(res, 'sales/by-employee', error, 'Error al generar el reporte por empleado.');
    }
  }

  @Get('sales/by-product')
  async getSalesByProduct(@Query() q: GetSalesByProductDto, @Res() res: Response) {
    try {
      const startDate = q.startDate ?? '';
      const endDate = q.endDate ?? '';
      const result = await this.reportsService.getSalesByProduct(startDate, endDate, q.limit, q.productId);
      const title = `Ventas por producto (${startDate} a ${endDate})`;
      const cols = [
        { header: 'Producto', key: 'product_name', width: 25 },
        { header: 'Cantidad', key: 'quantity', width: 12 },
        { header: 'Ingresos', key: 'revenue', currency: true, width: 15 },
      ];
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({ rows: result.productSales, title, columns: cols }),
          `ventas_por_producto_${startDate}_${endDate}.xlsx`,
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({ rows: result.productSales, title, columns: cols }),
          `ventas_por_producto_${startDate}_${endDate}.pdf`,
        );
      return this.sendJSON(res, result);
    } catch (error) {
      this.handleError(res, 'sales/by-product', error, 'Error al generar el reporte por producto.');
    }
  }

  // ==================== REPORTES DE INVENTARIO ====================
  @Get('inventory/current-stock')
  async getCurrentStock(@Query() q: GetCurrentStockDto, @Res() res: Response) {
    try {
      const rows = await this.reportsService.getCurrentStock(q.productId, q.tankId);
      const title = 'Stock actual';
      const cols = [
        { header: 'Tanque', key: 'tankName', width: 20 },
        { header: 'Producto', key: 'productName', width: 25 },
        { header: 'Stock Actual', key: 'currentStock', width: 15 },
        { header: 'Capacidad', key: 'capacity', width: 15 },
        { header: '% Llenado', key: 'fillPercentage', width: 12 },
      ];
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({ rows, title, columns: cols }),
          'stock_actual.xlsx',
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({ rows, title, columns: cols, landscape: true }),
          'stock_actual.pdf',
        );
      return this.sendJSON(res, rows);
    } catch (error) {
      this.handleError(res, 'inventory/current-stock', error, 'Error al generar el reporte de stock.');
    }
  }

  @Get('inventory/movements')
  async getInventoryMovements(@Query() q: GetInventoryMovementsDto, @Req() req: Request, @Res() res: Response) {
    try {
      const startDate = q.startDate ?? '';
      const endDate = q.endDate ?? '';
      const user: any = (req as any)?.user ?? undefined;

      const result = await this.reportsService.getInventoryMovements(
        startDate,
        endDate,
        q.movementType,
        q.productId,
        q.tankId,
        user,
      );

      const rows = result.movementDetails || [];
      const title = `Movimientos de inventario (${startDate} a ${endDate})`;
      const cols = [
        { header: 'Fecha/Hora', key: 'fecha_hora', width: 20 },
        { header: 'Producto', key: 'producto', width: 26 },
        { header: 'Tanque', key: 'tanque', width: 20 },
        { header: 'Tipo', key: 'tipo', width: 12 },
        { header: 'Cantidad', key: 'cantidad', width: 14 },
        { header: 'Motivo', key: 'motivo', width: 28 },
        { header: 'Usuario', key: 'user_id', width: 10 },
      ];
      const format = this.fmt(q);

      if (format === 'excel') {
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({ rows, title, columns: cols }),
          `movimientos_inventario_${startDate}_${endDate}.xlsx`,
        );
      }
      if (format === 'pdf') {
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({ rows, title, columns: cols, landscape: true }),
          `movimientos_inventario_${startDate}_${endDate}.pdf`,
        );
      }

      return this.sendJSON(res, result);
    } catch (error) {
      this.handleError(res, 'inventory/movements', error, 'Error al generar el reporte de movimientos.');
    }
  }

  @Get('inventory/tank-variations')
  async getTankVariations(@Query() q: GetInventoryMovementsDto, @Res() res: Response) {
    try {
      const startDate = q.startDate ?? '';
      const endDate = q.endDate ?? '';
      const result = await this.reportsService.getTankVariations(startDate, endDate, q.tankId);
      const rows = result.variations || [];
      const title = `Variaciones de tanques (${startDate} a ${endDate})`;
      const cols = [
        { header: 'Fecha', key: 'date', width: 15 },
        { header: 'Tanque ID', key: 'tank_id', width: 12 },
        { header: 'Cantidad Neta', key: 'net_quantity', width: 15 },
      ];
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({ rows, title, columns: cols }),
          `variaciones_tanques_${startDate}_${endDate}.xlsx`,
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({ rows, title, columns: cols }),
          `variaciones_tanques_${startDate}_${endDate}.pdf`,
        );
      return this.sendJSON(res, result);
    } catch (error) {
      this.handleError(res, 'inventory/tank-variations', error, 'Error al generar el reporte de variaciones.');
    }
  }

  // ==================== REPORTES FINANCIEROS ====================
  @Get('financial/income-vs-expenses')
  async getIncomeVsExpenses(@Query() q: GetIncomeVsExpensesDto, @Res() res: Response) {
    try {
      const startDate = q.startDate ?? '';
      const endDate = q.endDate ?? '';
      const result = await this.reportsService.getIncomeVsExpenses(startDate, endDate, q.expenseCategory);
      const rows = [
        { concepto: 'Ingresos Totales', monto: result.totalIncome },
        { concepto: 'Gastos Totales', monto: result.totalExpenses },
        { concepto: 'Ganancia Neta', monto: result.netProfit },
      ];
      const title = `Ingresos vs Gastos (${startDate} a ${endDate})`;
      const cols = [
        { header: 'Concepto', key: 'concepto', width: 25 },
        { header: 'Monto', key: 'monto', currency: true, width: 15 },
      ];
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({ rows, title, columns: cols }),
          `ingresos_vs_gastos_${startDate}_${endDate}.xlsx`,
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({ rows, title, columns: cols }),
          `ingresos_vs_gastos_${startDate}_${endDate}.pdf`,
        );
      return this.sendJSON(res, result);
    } catch (error) {
      this.handleError(res, 'financial/income-vs-expenses', error, 'Error al generar el reporte de ingresos vs gastos.');
    }
  }

  @Get('financial/cash-flow')
  async getCashFlow(@Query() q: GetCashFlowDto, @Res() res: Response) {
    try {
      const startDate = q.startDate ?? '';
      const endDate = q.endDate ?? '';
      const result = await this.reportsService.getCashFlow(startDate, endDate, q.paymentMethod);
      const rows = [
        { concepto: 'Efectivo Recibido', monto: result.cashReceived },
        { concepto: 'Transferencias Recibidas', monto: result.transfersReceived },
      ];
      const title = `Flujo de Caja (${startDate} a ${endDate})`;
      const cols = [
        { header: 'Concepto', key: 'concepto', width: 25 },
        { header: 'Monto', key: 'monto', currency: true, width: 15 },
      ];
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({ rows, title, columns: cols }),
          `flujo_de_caja_${startDate}_${endDate}.xlsx`,
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({ rows, title, columns: cols }),
          `flujo_de_caja_${startDate}_${endDate}.pdf`,
        );
      return this.sendJSON(res, result);
    } catch (error) {
      this.handleError(res, 'financial/cash-flow', error, 'Error al generar el reporte de flujo de caja.');
    }
  }

  // ==================== CRÉDITOS (GENÉRICOS) ====================
  @Get('credits/outstanding')
  async getOutstandingCredits(@Query() q: GetOutstandingCreditsDto, @Res() res: Response) {
    try {
      const result = await this.reportsService.getOutstandingCredits(
        q.clientId,
        q.status,
        q.dueDateStart,
        q.dueDateEnd,
      );
      const rows = result.creditsDetails || [];
      const title = 'Créditos Pendientes';
      const cols = [
        { header: 'Cliente', key: 'client_name', width: 25 },
        { header: 'Saldo', key: 'balance', currency: true, width: 15 },
        { header: 'Fecha Vencimiento', key: 'due_date', width: 18 },
        { header: 'Monto Total', key: 'total_amount', currency: true, width: 15 },
        { header: 'Monto Pagado', key: 'amount_paid', currency: true, width: 15 },
        { header: 'Días Vencido', key: 'days_overdue', width: 12 },
      ];
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({ rows, title, columns: cols }),
          'creditos_pendientes.xlsx',
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({ rows, title, columns: cols, landscape: true }),
          'creditos_pendientes.pdf',
        );
      return this.sendJSON(res, result);
    } catch (error) {
      this.handleError(res, 'credits/outstanding', error, 'Error al generar el reporte de créditos pendientes.');
    }
  }

  @Get('credits/collections')
  async getCollections(@Query() q: GetCollectionsDto, @Res() res: Response) {
    try {
      const startDate = q.startDate ?? '';
      const endDate = q.endDate ?? '';
      const result = await this.reportsService.getCollections(startDate, endDate, q.clientId, q.paymentMethod);
      const rows = result.collectionsDetails || [];
      const title = `Cobranzas (${startDate} a ${endDate})`;
      const cols = [
        { header: 'Cliente', key: 'client_name', width: 25 },
        { header: 'Monto', key: 'amount', currency: true, width: 15 },
        { header: 'Fecha Pago', key: 'payment_date', width: 18 },
        { header: 'Método Pago', key: 'payment_method', width: 20 },
      ];
      const format = this.fmt(q);

      if (format === 'excel')
        return this.sendExcel(
          res,
          await this.reportsService.exportAggregationToExcel({ rows, title, columns: cols }),
          `cobranzas_${startDate}_${endDate}.xlsx`,
        );
      if (format === 'pdf')
        return this.sendPDF(
          res,
          await this.reportsService.exportAggregationToPDF({ rows, title, columns: cols }),
          `cobranzas_${startDate}_${endDate}.pdf`,
        );
      return this.sendJSON(res, result);
    } catch (error) {
      this.handleError(res, 'credits/collections', error, 'Error al generar el reporte de cobranzas.');
    }
  }
}