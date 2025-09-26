import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Tank } from '../../tanks/entities/tank.entity';
import { Pump } from '../../pumps/entities/pump.entity';
import { MeterReading } from '../../meter-readings/entities/meter-reading.entity';

@Entity('nozzles')
export class Nozzle {
  @PrimaryGeneratedColumn('increment')
  nozzle_id: number;

  @Column({ type: 'integer', nullable: false })
  pump_id: number;

  @ManyToOne(() => Pump, (pump) => pump.nozzles, { eager: false })
  @JoinColumn({ name: 'pump_id' })
  pump: Pump;

  @Column({ type: 'integer', nullable: false })
  product_id: number;

  @ManyToOne(() => Product, { eager: true }) // eager loading para cargar automáticamente el producto
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'integer', nullable: false })
  tank_id: number;

  @ManyToOne(() => Tank, (tank) => tank.tank_id, { eager: false })
  @JoinColumn({ name: 'tank_id' })
  tank: Tank;

  @Column({ type: 'integer', nullable: false, unique: true })
  nozzle_number: number;

  @Column({ type: 'varchar', nullable: true })
  estado: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at: Date;

  @OneToMany(() => MeterReading, (meterReading) => meterReading.nozzle)
  meterReadings: MeterReading[];
}