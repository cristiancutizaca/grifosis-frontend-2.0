import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Nozzle } from '../../nozzles/entities/nozzle.entity';
import { DeliveryDetail } from '../../delivery-details/entities/delivery-detail.entity'
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn({ name: 'product_id' })
  product_id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  fuel_type?: string;

  @Column()
  unit: string;

  @Column('decimal', { precision: 10, scale: 2 })
  unit_price: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => Nozzle, (nozzle: Nozzle) => nozzle.product)
  nozzles: Nozzle[];

  @OneToMany(() => DeliveryDetail, (deliveryDetail) => deliveryDetail.product)
  deliveryDetails: DeliveryDetail[];
}
