import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Credit } from '../credits/entities/credit.entity';

@Injectable()
export class PaymentsService {
  [x: string]: any;
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private dataSource: DataSource,
  ) { }

  // ...
  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { credit_id, amount, user_id } = createPaymentDto;

      if (credit_id) {
        // Solo verificamos que el crédito exista y opcionalmente pre-validamos.
        const credit = await queryRunner.manager.findOne(Credit, {
          where: { credit_id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!credit) {
          throw new NotFoundException(`El crédito con ID ${credit_id} no fue encontrado.`);
        }

        // (Opcional) Pre-check amable; el trigger igual lo valida.
        const remaining = Number(credit.credit_amount) - Number(credit.amount_paid);
        if (amount > remaining) {
          throw new Error(`El pago (${amount}) excede la deuda restante (${remaining}).`);
        }

        // 🔴 Importante: NO actualizar aquí amount_paid ni status.
        // El trigger AFTER INSERT lo hará de forma atómica.
      }

      const payment = queryRunner.manager.create(Payment, {
        ...createPaymentDto,
        user_id, // asegurar
      });

      const savedPayment = await queryRunner.manager.save(payment);
      await queryRunner.commitTransaction();
      return savedPayment;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }


  async findAll(): Promise<Payment[]> {
    // Trae todos los pagos, ordenados del más reciente
    return await this.paymentsRepository.find({
      order: { payment_timestamp: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Payment | null> {
    return await this.paymentsRepository.findOne({
      where: { payment_id: id },
    });
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto): Promise<Payment | null> {
    await this.paymentsRepository.update(id, updatePaymentDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.paymentsRepository.delete(id);
  }

  // Obtener pagos por método de pago
  async getPaymentsByMethod(methodId: number): Promise<Payment[]> {
    return await this.paymentsRepository.find({
      where: { payment_method_id: methodId },
      order: { payment_timestamp: 'DESC' },
    });
  }

  // Pagos por rango de fecha (usando payment_timestamp)
  async getPaymentsByDateRange(startDate: string, endDate: string): Promise<any> {
    const query = `
      SELECT 
        p.*,
        pm.name as payment_method_name,
        s.total_amount as sale_amount,
        c.credit_amount
      FROM payments p
      LEFT JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
      LEFT JOIN sales s ON p.sale_id = s.sale_id
      LEFT JOIN credits c ON p.credit_id = c.credit_id
      WHERE p.payment_timestamp BETWEEN $1 AND $2
      ORDER BY p.payment_timestamp DESC
    `;
    return this.dataSource.query(query, [startDate, endDate]);
  }

  // Ejemplo de reporte de conciliación para un día específico
  async getConciliationReport(date: string): Promise<any> {
    const query = `
      SELECT 
        pm.name as payment_method,
        COUNT(p.payment_id) as transaction_count,
        SUM(p.amount) as total_amount
      FROM payments p
      JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
      WHERE DATE(p.payment_timestamp) = $1
      GROUP BY pm.payment_method_id, pm.name
      ORDER BY pm.name
    `;
    return this.dataSource.query(query, [date]);
  }

  async getPaymentStatus(): Promise<any> {
    const query = `
    SELECT 
      status,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM payments
    GROUP BY status
  `;

    return this.paymentsRepository.query(query);
  }

  // Conciliación por rango de fechas
  async reconcilePayments(startDate: string, endDate: string): Promise<any> {
    const query = `
      SELECT 
        p.payment_id,
        p.amount,
        p.payment_method_id,
        p.sale_id,
        p.credit_id,
        s.total_amount as sale_amount,
        c.credit_amount
      FROM payments p
      LEFT JOIN sales s ON p.sale_id = s.sale_id
      LEFT JOIN credits c ON p.credit_id = c.credit_id
      WHERE p.payment_timestamp BETWEEN $1 AND $2
      ORDER BY p.payment_timestamp DESC
    `;
    return this.dataSource.query(query, [startDate, endDate]);
  }

  // === SOLO este método fue modificado ===
  async findRecentCreditPayments(page = 1, pageSize = 10) {
    const take = Math.max(1, Number(pageSize) || 10);
    const skip = Math.max(0, ((Number(page) || 1) - 1) * take);

    // Usamos el repo correcto y joins por tabla para no depender de nombres de relaciones
    const qb = this.paymentsRepository.createQueryBuilder('p')
      .leftJoin('credits', 'c', 'c.credit_id = p.credit_id')
      .leftJoin('clients', 'cl', 'cl.client_id = c.client_id')
      .leftJoin('sales', 's', 's.sale_id = COALESCE(p.sale_id, c.sale_id)')
      .leftJoin('payment_methods', 'pm', 'pm.payment_method_id = p.payment_method_id')
      .where('p.credit_id IS NOT NULL')
      .orderBy('p.payment_timestamp', 'DESC')
      .offset(skip)
      .limit(take)
      .select([
        'p.payment_id                              AS "paymentId"',
        'p.amount::numeric                         AS amount',
        'p.payment_timestamp                       AS "timestamp"',
        'p.status                                  AS status',
        'p.credit_id                                AS "creditId"',
        'COALESCE(p.sale_id, c.sale_id)            AS "saleId"',
        'COALESCE(pm.method_name, pm.name)         AS method',
        `COALESCE(
            NULLIF(TRIM(cl.first_name || ' ' || cl.last_name), ''),
            cl.company_name,
            'Sin cliente'
          )                                         AS "clientName"`,
      ]);

    const [rows, total] = await Promise.all([
      qb.getRawMany(),
      this.paymentsRepository.createQueryBuilder('p')
        .where('p.credit_id IS NOT NULL')
        .getCount(),
    ]);

    const items = rows.map((r: any) => ({
      paymentId: Number(r.paymentId),
      amount: Number(r.amount ?? 0),
      method: r.method ?? 'desconocido',
      timestamp: r.timestamp,
      creditId: r.creditId ? Number(r.creditId) : null,
      clientName: r.clientName ?? 'Sin cliente',
      saleId: r.saleId ? Number(r.saleId) : null,
      status: r.status ?? 'completed',
    }));

    return { items, total: Number(total || 0), page: Number(page || 1), pageSize: take };
  }
}
