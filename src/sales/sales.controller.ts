import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
  UseGuards,
  Request,
  SetMetadata,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { SalesService, SaleFilters } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { PumpsService } from '../pumps/pumps.service';
import { DataSource } from 'typeorm';

@Controller('sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly pumpsService: PumpsService,
    private readonly ds: DataSource,
  ) {}

  /**
   * Helper para extraer de forma segura los datos del usuario desde el JWT,
   * considerando payloads con snake_case o camelCase.
   */
  private extractAuth(req?: any): {
    userId: number | null;
    role: string | null;
    employeeId: number | null;
    raw: any;
  } {
    const u = req?.user ?? {};
    const userId =
      (typeof u.userId === 'number' && u.userId) ||
      (typeof u.id === 'number' && u.id) ||
      (typeof u.user_id === 'number' && u.user_id) ||
      null;

    const employeeId =
      (typeof u.employeeId === 'number' && u.employeeId) ||
      (typeof u.employee_id === 'number' && u.employee_id) ||
      null;

    const role = typeof u.role === 'string' ? u.role : null;

    return { userId, role, employeeId, raw: u };
  }

  /**
   * BLOQUEO GLOBAL DE VENTAS:
   * Verifica que exista alguna caja ABIERTA hoy (zona Lima), sin importar turno.
   * Si no hay, lanza error y bloquea la operación.
   */
  private async ensureCashOpenGlobal(): Promise<void> {
    const rows: any[] = await this.ds.query(`
      SELECT 1
      FROM public.cash_box_sessions
      WHERE day_date = (now() AT TIME ZONE 'America/Lima')::date
        AND is_closed = false
      LIMIT 1;
    `);
    if (!rows?.length) {
      throw new BadRequestException('Caja no abierta. Abra la caja para poder registrar/anular ventas.');
    }
  }

  @Get('this-year')
  async getSalesThisYear() {
    return this.salesService.findAllThisYear();
  }

  @Get('trends')
  getTrends() {
    return this.salesService.getTrends();
  }

  @Get()
  findAllOrRecent(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('clientId') clientId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('employeeId') employeeId?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: SaleFilters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (clientId) filters.clientId = +clientId;
    if (productId) filters.productId = +productId;
    if (status) filters.status = status;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (employeeId) filters.employeeId = +employeeId;

    const take = Math.min(Math.max(parseInt(limit || '0', 10) || 0, 0), 100);

    // Sin filtros y con limit => "recientes"
    if (take > 0 && Object.keys(filters).length === 0) {
      return this.salesService.findRecent(take);
    }

    // Con filtros (o sin limit) => listado normal (con take opcional)
    return this.salesService.findAll(filters, take || undefined);
  }

  @Get('recent')
  getRecent(@Query('limit') limit: string = '25') {
    const take = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    return this.salesService.findRecent(take);
  }

  @Post()
  @UseGuards(OptionalAuthGuard)
  async create(@Body() createSaleDto: CreateSaleDto, @Request() req?: any) {
    // BLOQUEO GLOBAL: caja abierta requerida para registrar ventas
    await this.ensureCashOpenGlobal();

    const { userId, role, employeeId } = this.extractAuth(req);

    // Resolver IDs efectivos (body tiene prioridad explícita; si no, toma del token)
    const resolvedUserId =
      (createSaleDto as any).user_id ?? (createSaleDto as any).userId ?? userId ?? null;

    const resolvedEmployeeId =
      (createSaleDto as any).employee_id ?? (createSaleDto as any).employeeId ?? employeeId ?? null;

    // Regla: sólo SELLER requiere employee_id; admin/superadmin no.
    if (role === 'seller' && !resolvedEmployeeId) {
      throw new BadRequestException('Seller debe tener employee_id para registrar una venta.');
    }

    // Ensamblar DTO final con los IDs resueltos (sin romper validaciones del service)
    const dtoFinal: CreateSaleDto & { user_id?: number; employee_id?: number | null } = {
      ...createSaleDto,
      ...(resolvedUserId != null ? { user_id: resolvedUserId } : {}),
      // employee_id puede ser null para admin/superadmin
      employee_id: resolvedEmployeeId ?? null,
    };

    // Pasamos también el user crudo por si el service necesita más datos del contexto
    return this.salesService.create(dtoFinal, req?.user ?? null);
  }

  @Get('pumps/products')
  getAllPumpsWithProducts() {
    return this.pumpsService.getProductsForAllPumps();
  }

  @Get('pumps/:id/products')
  getProductsForPump(@Param('id', ParseIntPipe) pumpId: number) {
    return this.pumpsService.getProductsForPump(pumpId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(+id);
  }

  @Put(':id/cancel')
  async cancelSale(
    @Param('id') id: string,
    @Body() data: { reason: string },
    @Request() req: any,
  ) {
    // BLOQUEO GLOBAL: caja abierta requerida para anular ventas
    await this.ensureCashOpenGlobal();

    const { userId, role } = this.extractAuth(req);
    if (!userId) {
      throw new BadRequestException('No se pudo identificar al usuario que cancela la venta.');
    }
    return this.salesService.cancelSale(+id, userId, data?.reason ?? '', role ?? 'user');
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSaleDto: UpdateSaleDto) {
    return this.salesService.update(+id, updateSaleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.salesService.remove(+id);
  }

  // ========= PÚBLICO =========
  @SetMetadata('isPublic', true)
  @Get('public-data')
  getPublicData() {
    return this.salesService.getPublicData();
  }

  // ========= PÚBLICO ENRIQUECIDO =========
  @SetMetadata('isPublic', true)
  @Get('public-data2')
  async getPublicData2(@Query('limit') limit?: string) {
    const take = Math.min(Math.max(parseInt(limit || '50', 10) || 50, 1), 500);

    const rows = await this.ds.query(
      `
      SELECT
        s.sale_id,
        s.sale_timestamp,
        s.status,
        s.client_id,
        s.nozzle_id,

        COALESCE(
          NULLIF(TRIM(c.company_name), ''),
          NULLIF(TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))), ''),
          'Cliente'
        ) AS client_name,

        nz.nozzle_number,
        p.pump_number,

        COALESCE(MAX(pr.name), '—') AS product_name,
        COALESCE(SUM(sd.quantity), 0) AS quantity,

        COALESCE(s.final_amount, s.total_amount) AS final_amount,
        s.total_amount,

        pm.method_name AS payment_method

      FROM sales s
      LEFT JOIN clients c            ON c.client_id             = s.client_id
      LEFT JOIN nozzles nz           ON nz.nozzle_id            = s.nozzle_id
      LEFT JOIN pumps p              ON p.pump_id               = nz.pump_id
      LEFT JOIN sale_details sd      ON sd.sale_id              = s.sale_id
      LEFT JOIN products pr          ON pr.product_id           = sd.product_id
      LEFT JOIN payment_methods pm   ON pm.payment_method_id    = s.payment_method_id

      GROUP BY
        s.sale_id, s.sale_timestamp, s.status, s.client_id, s.nozzle_id,
        c.company_name, c.first_name, c.last_name,
        nz.nozzle_number, p.pump_number, pm.method_name,
        s.final_amount, s.total_amount

      ORDER BY s.sale_timestamp DESC
      LIMIT $1
      `,
      [take],
    );

    return {
      items: rows.map((r: any) => ({
        sale_id: r.sale_id,
        sale_timestamp: r.sale_timestamp,
        status: r.status,
        client_id: r.client_id,
        client_name: r.client_name,
        nozzle_id: r.nozzle_id,
        nozzle_number: r.nozzle_number,
        pump_number: r.pump_number,
        product_name: r.product_name,
        quantity: Number(r.quantity) || 0,
        total_amount: Number(r.total_amount) || Number(r.final_amount) || 0,
        final_amount: Number(r.final_amount) || Number(r.total_amount) || 0,
        payment_method: r.payment_method || null,
      })),
      total: rows.length,
    };
  }
}
