import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { Employee } from '../../entities/employee.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { SaleDetail } from '../../sale-details/entities/sale-detail.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn()
  sale_id: number;

  @Column({ nullable: true })
  client_id: number;

  @Column()
  user_id: number;

  @Column({ nullable: true })
  employee_id: number;

  @Column()
  nozzle_id: number;

  @Column({ type: 'timestamp' })
  sale_timestamp: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  final_amount: number;

  @Column()
  payment_method_id: number;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  shift: string;


  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => PaymentMethod, { nullable: true })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod;

  @OneToMany(() => Payment, (payment) => payment.sale)
  payments: Payment[];

  @OneToMany(() => SaleDetail, (saleDetail) => saleDetail.sale)
  saleDetails: SaleDetail[];

  // Getter para sale_date (compatible con reportes)
  get sale_date(): Date {
    return this.sale_timestamp;
  }
}
