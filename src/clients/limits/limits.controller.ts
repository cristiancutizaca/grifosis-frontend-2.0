import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { LimitsService } from './limits.service';
import {
  ListLimitsQueryDto,
  PatchActiveDto,
  PeriodKind,
  UpsertClientProductLimitDto,
} from './dto/upsert-limit.dto';

@Controller('clients')
export class LimitsController {
  constructor(private readonly svc: LimitsService) {}

  /**
   * Listar límites de un cliente.
   * Filtros opcionales: productId, periodKind ('day'|'week'|'month'), onlyActive
   * GET /api/clients/:clientId/limits?productId=2&periodKind=month&onlyActive=true
   */
  @Get(':clientId/limits')
  async list(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query() query: ListLimitsQueryDto,
  ) {
    return this.svc.list(clientId, query);
  }

  /**
   * Crear/actualizar límite de un producto (por período).
   * PUT /api/clients/:clientId/limits/products/:productId
   * Body: { periodKind, maxGallons, applyToAllPayments?, isActive? }
   */
  @Put(':clientId/limits/products/:productId')
  async upsert(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpsertClientProductLimitDto,
  ) {
    return this.svc.upsertLimit(clientId, productId, dto);
  }

  /**
   * Activar / desactivar límite(s) de un producto.
   * - Si pasas ?period=month afecta SOLO ese período.
   * - Si omites ?period, afecta TODOS los períodos de ese producto para ese cliente.
   *
   * PATCH /api/clients/:clientId/limits/products/:productId/active?period=month
   * Body: { isActive: true | false }
   */
  @Patch(':clientId/limits/products/:productId/active')
  async patchActive(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Query('period') periodKind: PeriodKind | undefined,
    @Body() dto: PatchActiveDto,
  ) {
    return this.svc.patchActive(clientId, productId, { ...dto, periodKind });
  }
}
