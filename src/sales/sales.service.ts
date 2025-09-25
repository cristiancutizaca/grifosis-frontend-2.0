import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Sale } from './entities/sale.entity';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { Nozzle } from '../nozzles/entities/nozzle.entity';
import { MeterReading } from '../meter-readings/entities/meter-reading.entity'; // LÍNEA NUEVA

// NUEVO: resolver método de pago y crear créditos
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { Credit } from '../credits/entities/credit.entity';
import { SalesTrendDto } from './types/sale';

// === NUEVO: entidades para inventario ===
import { Tank } from '../tanks/entities/tank.entity';
import { SaleDetail } from '../sale-details/entities/sale-detail.entity';
import { StockMovement } from '../stock-movements/entities/stock-movement.entity';

export interface SaleFilters {
  startDate?: string;
  endDate?: string;
  clientId?: number;
  productId?: number;
  status?: string;
  paymentMethod?: string; // llega como string desde query
  employeeId?: number;
}

export interface DynamicPricing {
  basePrice: number;
  shiftMultiplier: number;
  timeMultiplier: number;
  finalPrice: number;
  appliedRules: string[];
}

/** Helper: extrae monto bruto desde notes */
function parseGrossFromNotes(notes?: string): number | null {
  if (!notes) return null;
  const m = String(notes).match(
    /\b(?:pagado_bruto|pago_bruto|importe|gross|amount_paid)\s*=\s*(?:S\/\s*)?([0-9]+(?:\.[0-9]+)?)/i,
  );
  return m ? Number(m[1]) : null;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(Nozzle)
    private nozzleRepository: Repository<Nozzle>,
    @InjectRepository(MeterReading) // Decorador añadido
    private meterReadingsRepository: Repository<MeterReading>, // LÍNEA NUEVA
    private dataSource: DataSource,
    private stockMovementsService: StockMovementsService,
  ) {}

  // ====== NUEVO: helpers de turno + candado de caja ======
  private getCurrentShift(now = new Date()): 'Leon' | 'Lobo' | 'Buho' {
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes >= 5 * 60 && minutes < 12 * 60) return 'Leon';
    if (minutes >= 12 * 60 && minutes < 19 * 60) return 'Lobo';
    return 'Buho'; // 19:00–04:59
  }

  private normalizeShift(shift?: string): 'Leon' | 'Lobo' | 'Buho' {
    const s = (shift || '').trim().toLowerCase();
    if (s === 'leon' || s === 'león') return 'Leon';
    if (s === 'lobo') return 'Lobo';
    if (s === 'buho' || s === 'búho') return 'Buho';
    return this.getCurrentShift();
  }

  // --------- validación GLOBAL de caja abierta ---------
  private async ensureCashBoxOpen(): Promise<'Leon' | 'Lobo' | 'Buho'> {
    const rows: { shift_name: string }[] = await this.dataSource.query(
      `
      SELECT shift_name
        FROM public.cash_box_sessions
       WHERE day_date = CURRENT_DATE
         AND is_closed = false
       ORDER BY opened_at DESC
       LIMIT 1
      `,
    );

    if (Array.isArray(rows) && rows.length > 0) {
      const s = String(rows[0]?.shift_name || '');
      return this.normalizeShift(s);
    }

    throw new ForbiddenException(
      'La caja NO está abierta hoy. Abre la caja antes de registrar ventas.',
    );
  }

  // Reglas de precios dinámicos
  private readonly pricingRules = {
    shifts: {
      morning: { multiplier: 1.0, description: 'Precio normal - turno mañana' },
      afternoon: { multiplier: 1.05, description: 'Precio +5% - turno tarde' },
      night: { multiplier: 1.1, description: 'Precio +10% - turno noche' },
      weekend: { multiplier: 1.15, description: 'Precio +15% - fin de semana' },
    },
    timeRanges: {
      peak_hours: {
        start: '18:00',
        end: '21:00',
        multiplier: 1.08,
        description: 'Precio +8% - horas pico',
      },
      early_morning: {
        start: '06:00',
        end: '08:00',
        multiplier: 0.95,
        description: 'Precio -5% - madrugada',
      },
    },
  };

  /** Normaliza el límite de “recientes” (default 25, min 1, max 100) */
  private normalizeRecentLimit(
    limit?: any,
    dft = 25,
    min = 1,
    max = 100,
  ): number {
    const n = Number(limit);
    if (!Number.isFinite(n) || n <= 0) return dft;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }

  /** Recientes por timestamp (DESC) */
  async findRecent(limit?: number) {
    const take = this.normalizeRecentLimit(limit);
    return this.salesRepository.find({
      order: { sale_timestamp: 'DESC' },
      take,
    });
  }

  async getAllSales() {
    return this.salesRepository.find({ order: { sale_id: 'DESC' } });
  }

  /** Alias para “recientes”, mantiene compatibilidad */
  async getRecentSales(limit?: number) {
    const take = this.normalizeRecentLimit(limit);
    return this.salesRepository.find({
      order: { sale_timestamp: 'DESC' },
      take,
    });
  }

  /**
   * Crear venta con candado de caja, resolución de método de pago y registro de crédito/pago.
   */
  async create(createSaleDto: CreateSaleDto, user?: any): Promise<Sale> {
    const usedShift = await this.ensureCashBoxOpen();
    if (!(createSaleDto as any).shift) {
      (createSaleDto as any).shift = usedShift;
    }

    // Precios dinámicos si viene habilitado (se mantiene tal cual)
    if ((createSaleDto as any).applyDynamicPricing) {
      const pricing = this.calculateDynamicPricing(
        Number(createSaleDto.total_amount || 0),
        (createSaleDto as any).shift,
        new Date()
      );
      createSaleDto.total_amount = pricing.finalPrice;
      (createSaleDto as any).final_amount =
        pricing.finalPrice - (Number((createSaleDto as any).discount_amount) || 0);
    }

    return await this.dataSource.transaction(async manager => {
      // 1) Método de pago por id o nombre
      let pm: PaymentMethod | null = null;

      if ((createSaleDto as any).payment_method_id) {
        pm = await manager.findOne(PaymentMethod, {
          where: { payment_method_id: (createSaleDto as any).payment_method_id },
        });
      }

      if (!pm && (createSaleDto as any).payment_method) {
        const raw = String((createSaleDto as any).payment_method).trim().toLowerCase();
        pm = await manager
          .createQueryBuilder(PaymentMethod, 'pm')
          .where('LOWER(pm.method_name) = :name', { name: raw })
          .getOne();
      }

      if (!pm) throw new BadRequestException('Método de pago inválido');

      // 2) Validar boquilla
      const nozzle = await manager.findOne(Nozzle, {
        where: { nozzle_id: (createSaleDto as any).nozzle_id },
      });
      if (!nozzle) throw new BadRequestException('Boquilla inválida');

      // 3) Montos (NORMALIZADOR)
      const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100; // 2 dec
      const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000; // 3 dec

      // IGV (si no viene, 0.18)
      const igv = Number((createSaleDto as any).igv_rate ?? 0.18);

      // PRECIO POR GALÓN (CON IGV, esperado)
      const P = Number((createSaleDto as any).unit_price ?? 0);

      // GALONES — usamos 'volume_gallons' y si no, 'quantity' (compat.)
      const G = Number(
        (createSaleDto as any).volume_gallons ??
        (createSaleDto as any).quantity ??
        0
      );

      // DESCUENTO en moneda
      const D = Number((createSaleDto as any).discount_amount ?? 0);

      // ====== CAMBIO CLAVE (solo esta parte) ======
      // 1) Bruto PRE-DESCUENTO (con IGV) — prioridad al que venga del front
      let grossPre = Number((createSaleDto as any).gross_amount);
      let cameFromPostDiscount = false;

      // 2) Fallback POR PRIORIDAD (no por Math.max):
      //    P*G (pre) -> notes (pre) -> total_amount*(1+igv) (post)
      if (!Number.isFinite(grossPre) || grossPre <= 0) {
        const fromPG = (P > 0 && G > 0) ? (P * G) : 0;
        const fromNotes = parseGrossFromNotes((createSaleDto as any).notes);
        const totalNet = Number((createSaleDto as any).total_amount || 0); // neto/base (post-desc.)
        const fromTotalGross = totalNet > 0 ? totalNet * (1 + igv) : 0;    // *** post-descuento ***

        if (fromPG > 0) {
          grossPre = fromPG; // pre-descuento
        } else if (Number.isFinite(fromNotes as number) && (fromNotes as number) > 0) {
          grossPre = fromNotes as number; // asumimos pre-descuento
        } else if (fromTotalGross > 0) {
          grossPre = fromTotalGross;      // ya post-descuento
          cameFromPostDiscount = true;
        } else {
          grossPre = 0;
        }
      }

      // 3) Total cobrado (con IGV) post-descuento:
      //    si la fuente ya era post-descuento, NO volver a restar D
      const grossPost = cameFromPostDiscount ? r2(grossPre) : r2(Math.max(0, grossPre - D));

      // 4) Desglose contable (IGV NO reduce el total cobrado)
      const net = igv >= 0 ? r2(grossPost / (1 + igv)) : r2(grossPost);
      const unit_price   = +r2(P).toFixed(2);
      const volume_gal   = +r3(G).toFixed(3);
      const gross_amount = +r2(cameFromPostDiscount ? (grossPost + D) : grossPre).toFixed(2); // pre-desc. si es posible
      const total_amount = +r2(net).toFixed(2);         // base
      const final_amount = +r2(grossPost).toFixed(2);   // total cobrado

      // Sobrescribe DTO coherente
      (createSaleDto as any).igv_rate       = +igv.toFixed(3);
      (createSaleDto as any).unit_price     = unit_price;
      (createSaleDto as any).volume_gallons = volume_gal;
      (createSaleDto as any).gross_amount   = gross_amount; // BRUTO (pre-desc.)
      (createSaleDto as any).total_amount   = total_amount; // BASE (sin IGV)
      (createSaleDto as any).final_amount   = final_amount; // TOTAL COBRADO (con IGV)

      if (!(final_amount > 0)) {
        throw new BadRequestException('Monto de venta inválido');
      }

      // 4) Determinar user_id y employee_id
      let userId = (createSaleDto as any).user_id;
      let employeeId = (createSaleDto as any).employee_id;

      if (user) {
        userId = user.user_id ?? user.userId;
        employeeId = user.employee_id;
      }

      const userIdNum = Number(userId ?? (createSaleDto as any).userId);
      if (!Number.isFinite(userIdNum) || userIdNum <= 0) {
        throw new BadRequestException('user_id requerido');
      }
      userId = userIdNum;

      // 5) Crear venta
      const sale = manager.create(Sale, {
        ...createSaleDto,
        user_id: userId,
        employee_id: employeeId,
        payment_method_id: pm.payment_method_id,
        total_amount,
        final_amount,
        status: 'completed',
        sale_timestamp: new Date(),
        created_at: new Date(),
      } as any);
      await manager.save(sale);

      // Monto BRUTO desde notes (si existe): para registrar pago/credito
      const grossFromNotes = parseGrossFromNotes((createSaleDto as any).notes);
      const grossAmount =
        Number.isFinite(grossFromNotes as number)
          ? +(grossFromNotes as number).toFixed(2)
          : final_amount;

      // 6) ¿Crédito? (pagos)
      const normalize = (s: any) =>
        String(s ?? '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();

      const isCredit =
        (pm as any)?.is_credit === true ||
        normalize((pm as any)?.code) === 'credito' ||
        normalize((pm as any)?.method_name) === 'credito';

      if (isCredit) {
        if (!(sale as any).client_id) throw new BadRequestException('Crédito requiere cliente');

        const due =
          (createSaleDto as any).due_date
            ? new Date((createSaleDto as any).due_date)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 días

        const credit = manager.create(Credit, {
          client_id: (sale as any).client_id,
          sale_id:   (sale as any).sale_id,
          credit_amount: grossAmount,
          amount_paid: 0,
          status: 'pending',
          due_date: due,
        } as any);
        await manager.save(credit);
      } else {
        // 7) Pago directo
        await manager.query(
          `
          INSERT INTO public.payments
            (user_id, sale_id, amount, payment_method_id, notes)
          VALUES
            ($1,     $2,       $3,     $4,                $5)
          `,
          [
            userId,
            (sale as any).sale_id,
            grossAmount,
            pm.payment_method_id,
            'Pago automático',
          ]
        );
      }

      // ===========================
      // BLOQUE INVENTARIO (SIEMPRE)
      // ===========================
      const volumeGal  = Number((createSaleDto as any).volume_gallons || 0);
      if (volumeGal > 0) {
        if (!nozzle?.tank_id || !nozzle?.product_id) {
          throw new BadRequestException('Boquilla inválida: falta tanque/producto asociado');
        }

        const unitPrice = Number((createSaleDto as any).unit_price || 0);
        const discount  = Number((createSaleDto as any).discount_amount || 0);
        const taxRate   = Number((createSaleDto as any).igv_rate ?? igv ?? 0.18);

        // Total de la línea CON IGV (antes de descuento)
        const grossLine = +(unitPrice * volumeGal).toFixed(2);
        // Base e impuesto (dos decimales)
        const baseLine  = +((grossLine / (1 + taxRate)) || 0).toFixed(2);
        const taxLine   = +((grossLine - baseLine) || 0).toFixed(2);

        // 1) Bloquear tanque y validar stock
        const tankRepo = manager.getRepository(Tank);
        const tank = await tankRepo
          .createQueryBuilder('t')
          .setLock('pessimistic_write')
          .where('t.tank_id = :id', { id: nozzle.tank_id })
          .getOne();

        if (!tank) throw new BadRequestException('Tanque asociado a la boquilla no existe');

        const current = Number(tank.current_stock || 0);
        if (current < volumeGal) {
          throw new BadRequestException(
            `Stock insuficiente en tanque #${nozzle.tank_id}. Actual: ${current.toFixed(3)} gal`
          );
        }

        // 2) Detalle de venta — aseguramos tax_amount NOT NULL y alias de nombres
        const discountLine = +(discount || 0).toFixed(2);
        const detail = manager.create(SaleDetail, {
          sale_id:            (sale as any).sale_id,
          product_id:         nozzle.product_id,
          quantity:           volumeGal,            // NUMERIC(10,3)
          unit_price_at_sale: unitPrice,            // precio con IGV
          subtotal:           baseLine,             // base sin IGV
          tax_amount:         taxLine,              // snake_case (BD)
          taxAmount:          taxLine,              // camelCase (entidad)
          discount_amount:    discountLine,
          discountAmount:     discountLine,
        } as any);
        await manager.save(detail);

        // 3) Movimiento de stock (SALIDA)
        const movement = manager.create(StockMovement, {
          product_id:         nozzle.product_id,
          tank_id:            nozzle.tank_id,
          user_id:            userIdNum,
          movement_timestamp: (sale as any).sale_timestamp || new Date(),
          movement_type:      'Salida',
          quantity:           volumeGal,
          sale_detail_id:     (detail as any).sale_detail_id,
          description:        `Venta #${(sale as any).sale_id} - Boquilla ${nozzle.nozzle_number}`,
        } as any);
        await manager.save(movement);

        // 4) Descontar tanque (guardar número, no string)
        tank.current_stock = String((current - volumeGal).toFixed(3));
        await tankRepo.save(tank);

        // ========= REEMPLAZO: siempre INSERT en meter_readings (tipos estrictos) =========
        {
          const mrRepo = manager.getRepository(MeterReading);

          // 1) Última lectura por boquilla (ordena solo por campos que EXISTEN en tu entidad)
          const last = await mrRepo.find({
            where: { nozzle_id: nozzle.nozzle_id },
            order: {
              created_at: 'DESC',
              // si tu entidad tiene PK "reading_id", deja la línea de abajo; si no, elimínala:
              reading_id: 'DESC' as any,
            },
            take: 1,
          });

          // 2) initial = último final (o 0 si no hay)
          const initial = Number(last[0]?.final_reading ?? 0);

          // 3) final = initial + volumen (3 decimales)
          const volGal = Number(Number(volumeGal).toFixed(3));
          const finalReading = Number((initial + volGal).toFixed(3));

          // 4) INSERT (sin id) — usa SOLO campos que seguro existen en tu entidad
          const reading = mrRepo.create({
            nozzle_id: nozzle.nozzle_id,
            initial_reading: initial,
            final_reading: finalReading,
            user_id: userIdNum,
            created_at: new Date(),
            // si tu entidad tiene "updated_at" con NOT NULL, añade:
            // updated_at: new Date(),
            // si tu entidad tiene "reading_timestamp", añade y BORRA created_at si no existe:
            // reading_timestamp: (sale as any).sale_timestamp || new Date(),
          });

          await mrRepo.save(reading); // INSERT
        }
        // ========= FIN REEMPLAZO =======================================================

      }

      return sale;
    });
  }

  /**
   * Listado con filtros. Si `limit` es válido, aplica `.take(limit)`.
   * Casteo seguro de `paymentMethod` para evitar errores de tipo.
   */
  async findAll(filters?: SaleFilters, limit?: number): Promise<Sale[]> {
    const query = this.salesRepository.createQueryBuilder('sale')
      .leftJoinAndSelect('sale.client', 'client')
      .leftJoinAndSelect('sale.employee', 'employee');

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('sale.created_at BETWEEN :startDate AND :endDate', {
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate),
      });
    }
    if (filters?.clientId) {
      query.andWhere('sale.client_id = :clientId', { clientId: filters.clientId });
    }
    if (filters?.employeeId) {
      query.andWhere('sale.employee_id = :employeeId', { employeeId: filters.employeeId });
    }
    if (filters?.status) {
      query.andWhere('sale.status = :status', { status: filters.status });
    }
    if (filters?.paymentMethod) {
      const pm = Number(filters.paymentMethod);
      if (Number.isFinite(pm)) {
        query.andWhere('sale.payment_method_id = :pm', { pm });
      }
    }
    if (filters?.productId) {
      query.leftJoin('sale_details', 'sd', 'sd.sale_id = sale.sale_id')
        .andWhere('sd.product_id = :productId', { productId: filters.productId });
    }

    query.orderBy('sale.created_at', 'DESC');
    if (limit && Number.isFinite(limit) && limit > 0) {
      const take = this.normalizeRecentLimit(limit);
      query.take(take);
    }

    return await query.getMany();
  }

  async findOne(id: number): Promise<Sale | null> {
    if (isNaN(id)) {
      throw new NotFoundException(`El ID de venta proporcionado no es un número válido.`);
    }
    return await this.salesRepository.findOne({
      where: { sale_id: id },
      relations: ['client', 'employee'],
    });
  }

  async update(id: number, updateSaleDto: UpdateSaleDto): Promise<Sale | null> {
    await this.salesRepository.update(id, updateSaleDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.salesRepository.delete(id);
  }

  // Historial filtrado de ventas (resumen)
  async getSalesHistory(filters: SaleFilters): Promise<{
    sales: Sale[];
    summary: {
      totalSales: number;
      totalAmount: number;
      averageTicket: number;
      salesByStatus: { [status: string]: number };
      salesByPaymentMethod: { [method: string]: number };
    }
  }> {
    const sales = await this.findAll(filters);
    const totalSales = sales.length;
    const totalAmount = sales.reduce(
      (sum, sale) => sum + Number((sale as any).final_amount ?? (sale as any).total_amount ?? 0),
      0
    );
    const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

    const salesByStatus = sales.reduce((acc, sale) => {
      acc[sale.status] = (acc[sale.status] || 0) + 1;
      return acc;
    }, {} as { [status: string]: number });

    const salesByPaymentMethod = sales.reduce((acc, sale) => {
      const method = (sale as any).paymentMethod?.method_name || 'unknown';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as { [method: string]: number });

    return { sales, summary: { totalSales, totalAmount, averageTicket, salesByStatus, salesByPaymentMethod } };
  }

  async cancelSale(id: number, userId: number, reason: string, userRole: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (!sale) throw new NotFoundException(`Venta con ID ${id} no encontrada`);
    if (sale.status === 'cancelled') throw new BadRequestException('La venta ya está anulada');

    const canCancel = this.canCancelSale(sale, userRole, userId);
    if (!canCancel.allowed) throw new ForbiddenException(canCancel.reason);

    sale.status = 'cancelled';
    sale.notes = (sale.notes || '') + `\n[ANULADA] ${new Date().toISOString()} - Usuario: ${userId} - Motivo: ${reason}`;
    return await this.salesRepository.save(sale);
  }

  private canCancelSale(sale: Sale, userRole: string, userId: number): { allowed: boolean; reason?: string } {
    if (userRole === 'superadmin') return { allowed: true };

    if (userRole === 'admin') {
      const today = new Date();
      const saleDate = new Date(sale.created_at);
      const isToday = today.toDateString() === saleDate.toDateString();
      if (!isToday) return { allowed: false, reason: 'Los administradores solo pueden anular ventas del día actual' };
      return { allowed: true };
    }

    if (userRole === 'seller') {
      if ((sale as any).user_id !== userId) return { allowed: false, reason: 'Los vendedores solo pueden anular sus propias ventas' };
      const today = new Date();
      const saleDate = new Date(sale.created_at);
      const isToday = today.toDateString() === saleDate.toDateString();
      if (!isToday) return { allowed: false, reason: 'Los vendedores solo pueden anular ventas del día actual' };
      const hoursDiff = (today.getTime() - saleDate.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 2) return { allowed: false, reason: 'No se pueden anular ventas después de 2 horas' };
      return { allowed: true };
    }

    return { allowed: false, reason: 'Sin permisos para anular ventas' };
  }

  // Precios dinámicos
  calculateDynamicPricing(basePrice: number, shift?: string, timestamp?: Date): DynamicPricing {
    let finalPrice = basePrice;
    let shiftMultiplier = 1.0;
    let timeMultiplier = 1.0;
    const appliedRules: string[] = [];

    const now = timestamp || new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    if (shift && (this.pricingRules.shifts as any)[shift]) {
      shiftMultiplier = (this.pricingRules.shifts as any)[shift].multiplier;
      appliedRules.push((this.pricingRules.shifts as any)[shift].description);
    }
    if (isWeekend) {
      shiftMultiplier = Math.max(shiftMultiplier, this.pricingRules.shifts.weekend.multiplier);
      appliedRules.push(this.pricingRules.shifts.weekend.description);
    }
    for (const [, rule] of Object.entries(this.pricingRules.timeRanges)) {
      if (this.isTimeInRange(currentTime, (rule as any).start, (rule as any).end)) {
        timeMultiplier = Math.max(timeMultiplier, (rule as any).multiplier);
        appliedRules.push((rule as any).description);
      }
    }

    finalPrice = basePrice * shiftMultiplier * timeMultiplier;

    return {
      basePrice,
      shiftMultiplier,
      timeMultiplier,
      finalPrice: Math.round(finalPrice * 100) / 100,
      appliedRules,
    };
  }

  private isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
    return currentTime >= startTime && currentTime <= endTime;
  }

  async getSalesByClient(clientId: number, filters?: Omit<SaleFilters, 'clientId'>): Promise<Sale[]> {
    return this.findAll({ ...filters, clientId });
  }

  async getSalesByEmployee(employeeId: number, filters?: Omit<SaleFilters, 'employeeId'>): Promise<Sale[]> {
    return this.findAll({ ...filters, employeeId });
  }

  async getSalesStats(filters?: SaleFilters): Promise<any> {
    const { sales, summary } = await this.getSalesHistory(filters ?? {});
    const salesByDay = sales.reduce((acc, sale) => {
      const day = new Date(sale.created_at).toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + Number((sale as any).final_amount ?? (sale as any).total_amount ?? 0);
      return acc;
    }, {} as { [day: string]: number });

    const salesByHour = sales.reduce(
      (acc, sale) => {
        const hour = new Date(sale.created_at).getHours();
        acc[hour] =
          (acc[hour] || 0) +
          Number((sale as any).final_amount ?? (sale as any).total_amount ?? 0);
        return acc;
      },
      {} as { [hour: number]: number },
    );

    return {
      ...summary,
      salesByDay,
      salesByHour,
      topClients: await this.getTopClientsBySales(filters, 5),
    };
  }

  private async getTopClientsBySales(
    filters?: SaleFilters,
    limit: number = 10,
  ): Promise<any[]> {
    let query = `
      SELECT c.client_id, c.name, COUNT(s.sale_id) AS total_sales, SUM(s.final_amount) AS total_amount
      FROM clients c
      INNER JOIN sales s ON c.client_id = s.client_id
      WHERE 1=1
    `;
    const params: any = {};

    if (filters?.startDate && filters?.endDate) {
      query += ' AND s.created_at BETWEEN :startDate AND :endDate';
      params.startDate = new Date(filters.startDate);
      params.endDate = new Date(filters.endDate);
    }

    query += `
      GROUP BY c.client_id, c.name
      ORDER BY total_amount DESC
      LIMIT :limit
    `;
    params.limit = limit;

    return this.dataSource.query(query, params);
  }

  async getSalesReport(startDate?: string, endDate?: string): Promise<any> {
    const filters: SaleFilters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    return this.getSalesHistory(filters);
  }

  // ==========================
  // NUEVO getPublicData real
  // ==========================
  async getPublicData(limit?: number): Promise<any[]> {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 500); // 1..500
    try {
      const rows: {
        sale_id: number;
        sale_timestamp: string;
        status: string;
        client_id: number;
        nozzle_id: number;
        total_amount: number;
        final_amount: number;
        unit_price: number;
        quantity: number;
        payment_method_id: number;
      }[] = await this.dataSource.query(
        `
        SELECT
          s.sale_id,
          s.sale_timestamp,
          s.status,
          s.client_id,
          s.nozzle_id,
          s.total_amount,
          s.final_amount,
          s.unit_price,
          s.volume_gallons AS quantity,
          s.payment_method_id
        FROM public.sales s
        ORDER BY s.sale_timestamp DESC NULLS LAST
        LIMIT $1
        `,
        [take],
      );
      return rows;
    } catch (err: any) {
      throw new BadRequestException({
        error: 'Error al obtener ventas.',
        detail: err?.detail || err?.message || 'Consulta inválida (public.sales).',
      });
    }
  }

  /**
   * Obtiene las ventas de este año para el dashboard (No todas las ventas)
   */
  async findAllThisYear(): Promise<Sale[]> {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const endOfYear = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

    return this.salesRepository
      .createQueryBuilder('sale')
      .where('sale.created_at BETWEEN :start AND :end', {
        start: startOfYear,
        end: endOfYear,
      })
      .orderBy('sale.created_at', 'DESC')
      .getMany();
  }

  /**
   * Calcula las tendencias de ventas en distintos rangos de tiempo 
   * (día, semana, mes y año), comparando el rango actual con el anterior.
   */
  async getTrends(): Promise<SalesTrendDto[]> {
    const trends: SalesTrendDto[] = [];

    const now = new Date();

    const calcMetrics = async (start: Date, end: Date) => {
      const qb = this.salesRepository.createQueryBuilder('sale')
        .select('SUM(sale.final_amount)', 'totalVentas')
        .addSelect('COUNT(sale.sale_id)', 'numVentas')
        .where('sale.sale_timestamp BETWEEN :start AND :end', { start, end });

      const raw = await qb.getRawOne();
      const totalVentas = parseFloat(raw.totalVentas) || 0;
      const numVentas = parseInt(raw.numVentas) || 0;
      const promedioVenta = numVentas > 0 ? totalVentas / numVentas : 0;
      return { totalVentas, numVentas, promedioVenta };
    };

    const percent = (curr: number, prev: number) => {
      if (prev === 0) return '+0%';
      const value = ((curr - prev) / prev) * 100;
      return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    };

    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1);
    const endYesterday = new Date(startToday);

    const today = await calcMetrics(startToday, endToday);
    const yesterday = await calcMetrics(startYesterday, endYesterday);

    trends.push({
      frecuencia: 'day',
      totalVentas: percent(today.totalVentas, yesterday.totalVentas),
      numVentas: percent(today.numVentas, yesterday.numVentas),
      promedioVenta: percent(today.promedioVenta, yesterday.promedioVenta),
    });

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const lastWeekStart = new Date(startOfWeek);
    lastWeekStart.setDate(startOfWeek.getDate() - 7);
    const lastWeekEnd = new Date(startOfWeek);

    const week = await calcMetrics(startOfWeek, now);
    const lastWeek = await calcMetrics(lastWeekStart, lastWeekEnd);

    trends.push({
      frecuencia: 'week',
      totalVentas: percent(week.totalVentas, lastWeek.totalVentas),
      numVentas: percent(week.numVentas, lastWeek.numVentas),
      promedioVenta: percent(week.promedioVenta, lastWeek.promedioVenta),
    });

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const month = await calcMetrics(startOfMonth, now);
    const lastMonth = await calcMetrics(lastMonthStart, lastMonthEnd);

    trends.push({
      frecuencia: 'month',
      totalVentas: percent(month.totalVentas, lastMonth.totalVentas),
      numVentas: percent(month.numVentas, lastMonth.numVentas),
      promedioVenta: percent(month.promedioVenta, lastMonth.promedioVenta),
    });

    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);

    const year = await calcMetrics(startOfYear, now);
    const lastYear = await calcMetrics(lastYearStart, lastYearEnd);

    trends.push({
      frecuencia: 'year',
      totalVentas: percent(year.totalVentas, lastYear.totalVentas),
      numVentas: percent(year.numVentas, lastYear.numVentas),
      promedioVenta: percent(year.promedioVenta, lastYear.promedioVenta),
    });

    return trends;
  }
}
