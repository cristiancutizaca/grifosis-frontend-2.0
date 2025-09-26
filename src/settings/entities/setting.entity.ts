import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryColumn()
  setting_id: number;

  @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
  company_name: string;

  @Column({ name: 'ruc', type: 'varchar', length: 11, unique: true })
  company_ruc: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email: string;

  @Column({ name: 'web_address', type: 'varchar', length: 255, nullable: true })
  web_address: string;

  @Column({ name: 'social_networks', type: 'json', nullable: true })
  social_networks: string[];

  @Column({ type: 'text', nullable: true })
  logo: string;

  @Column({ name: 'shift_hours', type: 'text', nullable: true })
  shift_hours: string;

  @Column({ name: 'payment_methods', type: 'text', nullable: true })
  payment_methods: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  currency: string;

  @Column({ type: 'text', nullable: true })
  invoices: string;

  @Column({ type: 'text', nullable: true })
  backup_path: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

