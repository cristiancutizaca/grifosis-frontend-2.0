import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'cash_box_sessions' })
@Unique('uniq_cash_box_day_shift', ['day_date', 'shift_name'])
export class CashBoxSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'date' })
  day_date!: string; // 'YYYY-MM-DD'

  @Column({ type: 'varchar', length: 50 })
  shift_name!: string; // Leon | Lobo | Buho

  @Column({ type: 'timestamp', default: () => 'now()' })
  opened_at!: Date;

  @Column({ type: 'int', nullable: true })
  opened_by!: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  opened_by_name!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  opening_amount!: string;

  @Index()
  @Column({ type: 'boolean', default: false })
  is_closed!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  closed_at!: Date | null;

  @Column({ type: 'int', nullable: true })
  closed_by!: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  closed_by_name!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  closing_amount!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  sales_amount!: string | null; // opcional (puedes setearlo al cerrar)

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
