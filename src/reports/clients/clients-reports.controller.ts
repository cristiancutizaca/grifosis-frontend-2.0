import { Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ClientsReportsService } from './clients-reports.service';

@Controller('reports/clients') // => /api/reports/clients
export class ClientsReportsController {
  constructor(private readonly service: ClientsReportsService) {}

  // ==================== JSON (ya existentes) ====================
  // GET /api/reports/clients/:clientId/sales/detail?from=...&to=...
  @Get(':clientId/sales/detail')
  async detail(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.detail(clientId, from, to);
  }

  // GET /api/reports/clients/:clientId/sales/summary?from=...&to=...&group=day|week|month
  @Get(':clientId/sales/summary')
  async summary(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('group') group: 'day' | 'week' | 'month' = 'day',
  ) {
    return this.service.summary(clientId, from, to, group);
  }

  // ==================== EXCEL (nuevo) ====================

  // GET /api/reports/clients/:clientId/sales/detail.xlsx?from=...&to=...
  @Get(':clientId/sales/detail.xlsx')
  async detailExcel(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportClientSalesDetailExcel(clientId, from, to);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cliente_${clientId}_ventas_detalle.xlsx"`,
    );
    return res.send(buffer);
  }

  // GET /api/reports/clients/:clientId/sales/summary.xlsx?from=...&to=...&group=day|week|month
  @Get(':clientId/sales/summary.xlsx')
  async summaryExcel(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('group') group: 'day' | 'week' | 'month' = 'day',
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportClientSalesSummaryExcel(clientId, from, to, group);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cliente_${clientId}_ventas_resumen_${group}.xlsx"`,
    );
    return res.send(buffer);
  }
}
