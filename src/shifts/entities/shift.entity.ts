// src/shifts/entities/shift.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../entities/user.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'start_time' })
  startTime: Date;

  @Column({ name: 'initial_amount', type: 'decimal', precision: 10, scale: 2 })
  initialAmount: number;

  @Column({ name: 'final_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  finalAmount?: number;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ name: 'total_sales', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalSales?: number;

  @Column({ name: 'cash_difference', type: 'decimal', precision: 10, scale: 2, nullable: true })
  cashDifference?: number;

  @Column({ default: 'open' }) // 'open', 'closed'
  status: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'opened_by' })
  openedBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closedBy?: User;
}
