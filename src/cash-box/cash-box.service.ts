import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashBoxSession } from './cash-box-session.entity';
import { CloseCashBoxDto, OpenCashBoxDto } from './dto/open-close.dto';

@Injectable()
export class CashBoxService {
  constructor(
    @InjectRepository(CashBoxSession)
    private readonly repo: Repository<CashBoxSession>,
  ) {}

  /* -------------------- utils -------------------- */
  private money(val: number): string {
    const n = Number.isFinite(val) ? val : 0;
    return n.toFixed(2);
  }

  /* -------------------- queries -------------------- */
  async getToday(day_date: string, shift_name: 'Leon' | 'Lobo' | 'Buho') {
    // 1) intenta coincidencia exacta (día + turno)
    let sess = await this.repo.findOne({
      where: { day_date, shift_name },
      order: { opened_at: 'DESC' as any },
    });

    // 2) si no hay, trae la última sesión ABIERTA de ese turno
    if (!sess) {
      sess = await this.repo.findOne({
        where: { shift_name, is_closed: false },
        order: { opened_at: 'DESC' as any },
      });
    }

    // 3) si tampoco, trae la última sesión (cerrada o abierta) de ese turno
    if (!sess) {
      sess = await this.repo.findOne({
        where: { shift_name },
        order: { opened_at: 'DESC' as any },
      });
    }

    if (!sess) {
      return { status: 'no_abierta', day_date, shift_name };
    }
    return { status: sess.is_closed ? 'cerrada' : 'abierta', ...sess };
  }

  /** <<< AÑADIDO: historial por día en formato de eventos >>> */
  async historyByDay(day_date: string) {
    const rows = await this.repo.find({
      where: { day_date },
      order: { opened_at: 'ASC' as any, closed_at: 'ASC' as any },
    });

    const events = rows.flatMap((r) => {
      const out: any[] = [
        {
          type: 'open',
          timestamp: r.opened_at,
          by: r.opened_by_name ?? (r.opened_by != null ? `Usuario ${r.opened_by}` : '—'),
          shift: r.shift_name,
          amount: Number(r.opening_amount ?? 0),
        },
      ];
      if (r.is_closed && r.closed_at) {
        out.push({
          type: 'close',
          timestamp: r.closed_at,
          by: r.closed_by_name ?? (r.closed_by != null ? `Usuario ${r.closed_by}` : '—'),
          shift: r.shift_name,
          totalInCash: Number(r.closing_amount ?? 0),
          notes: r.notes ?? undefined,
        });
      }
      return out;
    });

    return { dateKey: day_date, events };
  }

  /* -------------------- commands -------------------- */
  async open(dto: OpenCashBoxDto) {
    const dup = await this.repo.findOne({
      where: { day_date: dto.day_date, shift_name: dto.shift_name },
    });
    if (dup) throw new ConflictException('Ya existe una sesión para ese día y turno');

    const row = this.repo.create({
      day_date: dto.day_date,
      shift_name: dto.shift_name,
      opening_amount: this.money(dto.opening_amount),
      opened_by: dto.opened_by ?? null,
      opened_by_name: dto.opened_by_name ?? null,
      // opened_at se setea por default
    });

    const saved = await this.repo.save(row);
    return saved; // incluye id
  }

  async close(dto: CloseCashBoxDto) {
    const sess = await this.repo.findOne({ where: { id: dto.id } });
    if (!sess) throw new NotFoundException('Sesión no encontrada');

    if (sess.is_closed) {
      // idempotente: ya cerrada, devolvemos estado actual
      return sess;
    }

    sess.is_closed = true;
    sess.closed_at = new Date();
    sess.closed_by = dto.closed_by ?? null;
    sess.closed_by_name = dto.closed_by_name ?? null;
    sess.closing_amount = this.money(dto.closing_amount);
    sess.notes = dto.notes ?? null;

    // opcional: sess.sales_amount = this.money(await this.calcSalesAmount(sess.day_date, sess.shift_name));

    const saved = await this.repo.save(sess);
    return saved;
  }

  // private async calcSalesAmount(day: string, shift: string): Promise<number> {
  //   return 0;
  // }
}
