import { Controller, Get, Query, Res, Req, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport'; // usa tu guard existente si el nombre difiere
import { ShiftsReportsService } from './shifts-reports.service';

function getUserId(req: Request): number {
  const u: any = (req as any).user || {};
  const id = u.user_id ?? u.id ?? u.sub; // ajusta si tu payload usa otra clave
  return Number(id);
}

@Controller('reports/shifts/my') // => /api/reports/shifts/my
@UseGuards(AuthGuard('jwt'))     // asegúrate de usar tu guard real
export class ShiftsMyReportsController {
  constructor(private readonly svc: ShiftsReportsService) {}

  // JSON: /api/reports/shifts/my/summary?from=...&to=...
  @Get('summary')
  async mySummary(
    @Req() req: Request,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const userId = getUserId(req);
    return this.svc.mySummary(from, to, userId);
  }

  // EXCEL: /api/reports/shifts/my/summary.xlsx?from=...&to=...
  @Get('summary.xlsx')
  async mySummaryExcel(
    @Req() req: Request,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const userId = getUserId(req);
    const rows = await this.svc.mySummary(from, to, userId);
    const buf  = await this.svc.exportShiftSummaryExcel(rows, from, to);
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="mis_turnos_${from}_${to}.xlsx"`);
    return res.send(buf);
  }

  // JSON: /api/reports/shifts/my/detail?from=...&to=...&shift=TurnoX
  @Get('detail')
  async myDetail(
    @Req() req: Request,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('shift') shift?: string,
  ) {
    const userId = getUserId(req);
    return this.svc.myDetail(from, to, userId, shift);
  }

  // EXCEL: /api/reports/shifts/my/detail.xlsx?from=...&to=...&shift=TurnoX
  @Get('detail.xlsx')
  async myDetailExcel(
    @Req() req: Request,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('shift') shift: string | undefined,
    @Res() res: Response,
  ) {
    const userId = getUserId(req);
    const rows = await this.svc.myDetail(from, to, userId, shift);
    const buf  = await this.svc.exportShiftDetailExcel(rows, from, to, shift);
    const safe = (shift || 'todos').replace(/\s+/g, '_');
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="mis_turnos_detalle_${safe}_${from}_${to}.xlsx"`);
    return res.send(buf);
  }
}
