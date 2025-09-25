import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Employee } from '../../entities/employee.entity';
import { DeliveryDetail } from 'src/delivery-details/entities/delivery-detail.entity';

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn()
  delivery_id: number;

  @Column()
  supplier_id: number;

  @Column({ nullable: true })
  employee_id: number;

  @Column({ type: 'timestamp' }) // ✅ PostgreSQL sí entiende esto
  delivery_date: Date;



  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string; // pending, received, cancelled

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relaciones
  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @OneToMany(() => DeliveryDetail, (deliveryDetail) => deliveryDetail.product)
  deliveryDetails: DeliveryDetail[];
}
