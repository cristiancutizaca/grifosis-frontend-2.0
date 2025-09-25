// src/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { MeterReading } from '../../meter-readings/entities/meter-reading.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ type: 'int', nullable: true })
  employee_id: number | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column()
  username: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true })
  full_name?: string;

  @Column()
  role: 'superadmin' | 'admin' | 'seller';

  @Column({ type: 'text', default: '{}' })
  permissions: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => MeterReading, (meterReading) => meterReading.nozzle)
  meterReadings: MeterReading[];
}
