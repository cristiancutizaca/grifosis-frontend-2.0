import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Client } from '../../clients/entities/client.entity'; // Cambia la ruta según tu estructura
import { Sale } from '../../sales/entities/sale.entity';       // Cambia la ruta según tu estructura
import { OneToMany } from 'typeorm';
import { Payment } from '../../payments/entities/payment.entity';



@Entity('credits')
export class Credit {
  @PrimaryGeneratedColumn()
  credit_id: number;

  @Column()
  client_id: number;

  @Column()
  sale_id: number;

  @Column('numeric')
  credit_amount: number;

  @Column('numeric', { default: 0 })
  amount_paid: number;

  @Column()
  due_date: Date;

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  // Relaciones si las necesitas
  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @OneToMany(() => Payment, (payment) => payment.credit)
  payments: Payment[];
}
