import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { Credit } from './entities/credit.entity';
import { Payment } from '../payments/entities/payment.entity';

type BulkPaymentItem = { credit_id: number; amount: number };
type BulkPaymentPayload = {
  items: BulkPaymentItem[];
  payment_method_id?: number;
  user_id?: number;
  notes?: string; // opcional
};

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(Credit)
    private creditsRepository: Repository<Credit>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private dataSource: DataSource,
  ) {}

  // ========= Utils numéricos seguros =========
  private num(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? 0 : n;
  }
  private round2(n: number) {
    return Math.round((this.num(n) + Number.EPSILON) * 100) / 100;
  }
  private normalizeCreditStatus(credit: Credit) {
    const paid = this.round2(this.num((credit as any).amount_paid));
    const total = this.round2(this.num((credit as any).credit_amount));
    (credit as any).amount_paid = paid;
    credit.status =
      paid >= total ? 'paid' : (credit.status === 'overdue' ? 'overdue' : 'pending');
    return credit;
  }
  private async getCreditForUpdate(manager: any, id: number): Promise<Credit> {
    const credit = await manager
      .createQueryBuilder(Credit, 'credit')
      .setLock('pessimistic_write')
      .where('credit.credit_id = :id', { id })
      .getOne();
    if (!credit) throw new NotFoundException(`Crédito ${id} no encontrado`);
    // Asegurar números
    (credit as any).credit_amount = this.num((credit as any).credit_amount);
    (credit as any).amount_paid = this.num((credit as any).amount_paid);
    return credit;
  }

  // ========= CRUD =========
  async create(createCreditDto: any): Promise<Credit> {
    const credit = this.creditsRepository.create({
      client_id: createCreditDto.client_id,
      sale_id: createCreditDto.sale_id,
      credit_amount: this.round2(this.num(createCreditDto.credit_amount)),
      amount_paid: 0,
      due_date: createCreditDto.due_date,
      status: 'pending',
    });
    return await this.creditsRepository.save(credit);
  }

  async findAll(filters?: any): Promise<Credit[]> {
    const query = this.creditsRepository
      .createQueryBuilder('credit')
      .leftJoinAndSelect('credit.client', 'client')
      .leftJoinAndSelect('credit.sale', 'sale');

    if (filters?.status) {
      query.andWhere('credit.status = :status', { status: filters.status });
    }
    if (filters?.overdue) {
      query.andWhere(
        'credit.due_date < :today AND credit.credit_amount > credit.amount_paid',
        { today: new Date() },
      );
    }

    const list = await query.orderBy('credit.due_date', 'ASC').getMany();
    // Normalizar números por si vienen como string
    for (const c of list) {
      (c as any).credit_amount = this.num((c as any).credit_amount);
      (c as any).amount_paid = this.num((c as any).amount_paid);
    }
    return list;
  }

  async findOne(id: number): Promise<Credit> {
    const credit = await this.creditsRepository.findOne({
      where: { credit_id: id },
      relations: ['client', 'sale'],
    });
    if (!credit) throw new NotFoundException(`Crédito ${id} no encontrado`);
    (credit as any).credit_amount = this.num((credit as any).credit_amount);
    (credit as any).amount_paid = this.num((credit as any).amount_paid);
    this.normalizeCreditStatus(credit);
    return credit;
  }

  // ========= Pago unitario =========
  async addPayment(
    id: number,
    amount: number,
    reference?: string,
    payment_method_id?: number,
    user_id?: number,
  ): Promise<Credit> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const credit = await this.getCreditForUpdate(queryRunner.manager, id);

      const roundedAmount = this.round2(this.num(amount));
      if (roundedAmount <= 0) {
        throw new BadRequestException('El monto debe ser mayor a 0');
      }

      const balance = this.round2(
        this.num((credit as any).credit_amount) - this.num((credit as any).amount_paid),
      );
      if (roundedAmount > balance) {
        throw new BadRequestException(
          `El pago no puede ser mayor al saldo pendiente (saldo: S/ ${balance.toFixed(2)})`,
        );
      }

      const paymentData: Partial<Payment> = {
        amount: roundedAmount,
        payment_method_id,
        credit_id: credit.credit_id,
        payment_type: 'credit',
        status: 'completed',
        user_id,
      };
      if (reference && reference.trim()) {
        (paymentData as any).notes = reference.trim();
      }

      const payment = queryRunner.manager.create(Payment, paymentData);
      await queryRunner.manager.save(Payment, payment);

      (credit as any).amount_paid = this.round2(
        this.num((credit as any).amount_paid) + roundedAmount,
      );
      // actualizar status (paid/pending/overdue)
      this.normalizeCreditStatus(credit);
      // si aún falta y ya venció, marcar overdue
      const total = this.num((credit as any).credit_amount);
      if ((credit as any).amount_paid < total && credit.due_date && new Date(credit.due_date) < new Date()) {
        credit.status = 'overdue';
      }

      await queryRunner.manager.save(Credit, credit);
      await queryRunner.commitTransaction();
      return credit;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ========= Pagos múltiples (bulk) =========
  async addPaymentsBulk(payload: BulkPaymentPayload) {
    const { items, payment_method_id, user_id, notes } = payload ?? {};
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Debe enviar al menos un ítem de pago');
    }

    // Combinar montos por crédito (por si vienen repetidos en la misma solicitud)
    const merged = new Map<number, number>();
    for (const it of items) {
      const cid = Number(it.credit_id);
      const amt = this.round2(this.num(it.amount));
      if (!cid || amt <= 0) continue;
      merged.set(cid, this.round2((merged.get(cid) ?? 0) + amt));
    }
    if (merged.size === 0) {
      throw new BadRequestException('Montos inválidos o iguales a 0');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updatedCredits: Credit[] = [];
      const createdPayments: Payment[] = [];

      for (const [creditId, amount] of merged.entries()) {
        const credit = await this.getCreditForUpdate(queryRunner.manager, creditId);

        const balance = this.round2(
          this.num((credit as any).credit_amount) - this.num((credit as any).amount_paid),
        );
        if (amount > balance) {
          throw new BadRequestException(
            `El pago de S/ ${amount.toFixed(2)} supera el saldo del crédito #${creditId} (saldo: S/ ${balance.toFixed(2)})`,
          );
        }

        const paymentData: Partial<Payment> = {
          amount: this.round2(amount),
          payment_method_id,
          credit_id: credit.credit_id,
          payment_type: 'credit',
          status: 'completed',
          user_id,
        };
        if (notes && notes.trim()) {
          (paymentData as any).notes = notes.trim();
        }

        const payment = queryRunner.manager.create(Payment, paymentData);
        await queryRunner.manager.save(Payment, payment);
        createdPayments.push(payment);

        (credit as any).amount_paid = this.round2(
          this.num((credit as any).amount_paid) + amount,
        );

        // actualizar status (paid/pending/overdue)
        this.normalizeCreditStatus(credit);
        const total = this.num((credit as any).credit_amount);
        if ((credit as any).amount_paid < total && credit.due_date && new Date(credit.due_date) < new Date()) {
          credit.status = 'overdue';
        }

        await queryRunner.manager.save(Credit, credit);
        updatedCredits.push(credit);
      }

      await queryRunner.commitTransaction();
      return {
        updated: updatedCredits,
        payments: createdPayments,
        count: createdPayments.length,
        totalAmount: this.round2(
          createdPayments.reduce((s, p) => s + this.num((p as any).amount), 0),
        ),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ========= Consultas auxiliares =========
  async getOverdueCredits(): Promise<Credit[]> {
    const list = await this.creditsRepository.find({
      where: {
        due_date: LessThan(new Date()),
      },
      relations: ['client', 'sale'],
      order: { due_date: 'ASC' },
    });
    // Normalizar importes y status coherente con deuda
    for (const c of list) {
      (c as any).credit_amount = this.num((c as any).credit_amount);
      (c as any).amount_paid = this.num((c as any).amount_paid);
      const balance = this.round2(this.num((c as any).credit_amount) - this.num((c as any).amount_paid));
      c.status = balance > 0 && c.due_date < new Date() ? 'overdue' : c.status;
    }
    return list.filter(c =>
      this.round2(this.num((c as any).credit_amount) - this.num((c as any).amount_paid)) > 0 &&
      c.due_date < new Date()
    );
  }

  async getCreditsDashboard(): Promise<any> {
    // Contar por estado calculado (paid / pending / overdue)
    const all = await this.creditsRepository.find();
    let paid = 0, overdue = 0, pending = 0;
    const now = new Date();

    for (const c of all) {
      const total = this.num((c as any).credit_amount);
      const paidAmt = this.num((c as any).amount_paid);
      const balance = this.round2(total - paidAmt);
      if (balance <= 0) paid++;
      else if (c.due_date && new Date(c.due_date) < now) overdue++;
      else pending++;
    }
    return { total: pending, overdue, paid };
  }

  async getCreditsToDashboard() {
    const credits = await this.creditsRepository.find({
      select: {
        credit_id: true,
        client_id: true,
        sale_id: true,
        credit_amount: true,
        amount_paid: true,
        due_date: true,
        status: true,
        created_at: true,
        updated_at: true,
        client: { client_id: true },
        sale: { sale_id: true },
      },
      relations: { client: true, sale: true },
      order: { created_at: 'DESC' },
    });

    return credits.map((c) => ({
      ...c,
      credit_amount: this.num((c as any).credit_amount),
      amount_paid: this.num((c as any).amount_paid),
      client: c.client ? { client_id: c.client.client_id } : null,
      sale: c.sale ? { sale_id: c.sale.sale_id } : null,
    }));
  }

  async update(id: number, updateData: Partial<Credit>): Promise<Credit> {
    const credit = await this.findOne(id);
    Object.assign(credit, updateData);
    (credit as any).credit_amount = this.num((credit as any).credit_amount);
    (credit as any).amount_paid = this.num((credit as any).amount_paid);
    this.normalizeCreditStatus(credit);
    return this.creditsRepository.save(credit);
  }

  async remove(id: number): Promise<void> {
    const result = await this.creditsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Credit with id ${id} not found`);
    }
  }
}
