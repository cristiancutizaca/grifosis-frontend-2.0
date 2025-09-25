import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Sale } from '../../sales/entities/sale.entity';
import { Credit } from '../../credits/entities/credit.entity';
import { OneToMany } from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  payment_id: number;

  @Column()
  user_id: number; // quién registró el pago

  @Column({ nullable: true })
  sale_id?: number;

  @Column({ nullable: true })
  credit_id?: number;

  @CreateDateColumn({ name: 'payment_timestamp' })
  payment_timestamp: Date;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column()
  payment_method_id: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column()
  payment_type: string; // 'cash' | 'credit'

  @Column({ default: 'completed' })
  status: string;


  @ManyToOne(() => Credit, (credit) => credit.payments, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'credit_id' })
  credit?: Credit;

  @ManyToOne(() => Sale, (sale) => sale.payments, { nullable: true })
  @JoinColumn({ name: 'sale_id' })
  sale?: Sale;
}
