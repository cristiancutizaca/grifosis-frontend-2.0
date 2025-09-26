import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { CreditsService } from './credits.service';

// DTOs ligeros / tipados (permitimos string para compatibilidad)
type BulkPaymentItemDto = { credit_id: number | string; amount: number | string };
type BulkPaymentsDto = {
  items: BulkPaymentItemDto[];
  payment_method_id?: number;
  user_id?: number;
  notes?: string; // referencia/observaciones opcional
};

@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  // Crear crédito
  @Post()
  create(@Body() createCreditDto: any) {
    return this.creditsService.create(createCreditDto);
  }

  // Listar créditos (con filtros opcionales)
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('overdue') overdue?: string,
    // param "include" ignorado (compat front viejo)
    @Query('include') _include?: string,
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (overdue === 'true') filters.overdue = true;
    return this.creditsService.findAll(filters);
  }

  // Dashboard counters (total, overdue, paid)
  @Get('dashboard')
  getDashboard() {
    return this.creditsService.getCreditsDashboard();
  }

  // Lista para dashboard (relaciones livianas)
  @Get('credits-dashboard')
  getCreditsToDashboard() {
    return this.creditsService.getCreditsToDashboard();
  }

  // Créditos vencidos (que aún tienen deuda)
  @Get('overdue')
  getOverdueCredits() {
    return this.creditsService.getOverdueCredits();
  }

  // Obtener un crédito
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.creditsService.findOne(id);
  }

  // Pagar un crédito (unitario)
  @Post(':id/payments')
  async addPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    paymentData: {
      amount: number | string;
      payment_method_id?: number;
      user_id?: number;
      reference?: string; // alias 1
      notes?: string;     // alias 2 (compat front)
    },
  ) {
    const amount = Number(paymentData?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto debe ser un número > 0');
    }
    const reference = (paymentData.reference ?? paymentData.notes)?.toString();
    return this.creditsService.addPayment(
      id,
      amount,
      reference,
      paymentData.payment_method_id,
      paymentData.user_id,
    );
  }

  // Pagar múltiples créditos en una sola transacción (bulk)
  @Post('payments/bulk')
  async addPaymentsBulk(@Body() body: BulkPaymentsDto) {
    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestException('Debe enviar al menos un ítem de pago');
    }

    // Normaliza items: number & > 0
    const items = body.items
      .map((it) => ({
        credit_id: Number(it.credit_id),
        amount: Number(it.amount),
      }))
      .filter(
        (it) =>
          Number.isFinite(it.credit_id) &&
          it.credit_id > 0 &&
          Number.isFinite(it.amount) &&
          it.amount > 0,
      );

    if (items.length === 0) {
      throw new BadRequestException('Montos inválidos o iguales a 0');
    }

    return this.creditsService.addPaymentsBulk({
      items,
      payment_method_id: body.payment_method_id,
      user_id: body.user_id,
      notes: body.notes,
    });
  }

  // Actualizar crédito
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: Partial<any>) {
    return this.creditsService.update(id, data);
  }
}
