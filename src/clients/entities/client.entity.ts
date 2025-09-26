import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Credit } from '../../credits/entities/credit.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  client_id: number;

  @Column({ nullable: true })
  client_type: string;

  @Column({ nullable: true })
  company_name: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  document_type: string;

  @Column({ nullable: true, unique: true })
  document_number: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  birth_date: Date;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relación OneToMany con créditos
  @OneToMany(() => Credit, (credit) => credit.client)
  credits: Credit[];
}
