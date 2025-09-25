import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  user_id: number; // Mantener user_id para PostgreSQL

  @Column({ nullable: true })
  employee_id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true, length: 255 }) // Agregar full_name
  full_name: string;

  @Column()
  role: string;

  @Column({ type: 'jsonb', nullable: true })
  permissions: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
