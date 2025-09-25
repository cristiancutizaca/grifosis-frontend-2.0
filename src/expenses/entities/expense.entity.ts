import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn()
  expense_id: number;

  @Column()
  amount: number;

  @Column()
  category: string;

  @Column()
  expense_date: Date;

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  is_recurring: boolean;

  @Column({ nullable: true })
  receipt_file: string; // 👈 este campo te faltaba

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
