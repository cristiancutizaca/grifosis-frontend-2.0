import {
  Body,
  Controller,
  Delete,
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

  /** Crear/actualizar límite de un producto */
  @Put(':clientId/limits/products/:productId')
  async upsert(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpsertClientProductLimitDto,
  ) {
    return this.svc.upsertLimit(clientId, productId, dto);
  }

  /** Activar/desactivar (opcionalmente con ?period=month para afectar uno solo) */
  @Patch(':clientId/limits/products/:productId/active')
  async setActive(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: PatchActiveDto,
    @Query('period') period?: PeriodKind,
  ) {
    return this.svc.setActive(clientId, productId, body, period);
  }

  /** Listar límites del cliente (filtros: period, active) */
  @Get(':clientId/limits/products')
  async list(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query() q: ListLimitsQueryDto,
  ) {
    return this.svc.listByClient(clientId, q);
  }

  /** Detalle de límite por producto+período */
  @Get(':clientId/limits/products/:productId')
  async getOne(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Query('period') period: PeriodKind = PeriodKind.Month,
  ) {
    return this.svc.getOne(clientId, productId, period);
  }

  /** Soft delete = desactivar un límite concreto */
  @Delete(':clientId/limits/products/:productId')
  async softDelete(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Query('period') period: PeriodKind = PeriodKind.Month,
  ) {
    return this.svc.deactivateOne(clientId, productId, period);
  }

  /** Consulta de uso/restante */
  @Get(':clientId/limits/products/:productId/usage')
  async usage(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Query('period') period: PeriodKind = PeriodKind.Month,
  ) {
    return this.svc.getUsage(clientId, productId, period);
  }
}
