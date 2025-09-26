import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Tank } from '../../tanks/entities/tank.entity';
import { User } from '../../users/entities/user.entity';
import { SaleDetail } from '../../sale-details/entities/sale-detail.entity';
import { DeliveryDetail } from '../../delivery-details/entities/delivery-detail.entity';
import { MovementType } from '../constants/stock-movement.constants';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn()
  stock_movement_id: number;

  @Column()
  product_id: number;

  @Column()
  tank_id: number;

  @Column()
  user_id: number;

  @CreateDateColumn({ type: 'timestamp', name: 'movement_timestamp' })
  movement_timestamp: Date;

  @Column({
    type: 'enum',
    enum: MovementType,
  })
  movement_type: MovementType;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  quantity: number;

  @Column({ nullable: true })
  sale_detail_id: number | null;

  @Column({ nullable: true })
  delivery_detail_id: number | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Relaciones
  @ManyToOne(() => Product, { eager: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Tank, { eager: false })
  @JoinColumn({ name: 'tank_id' })
  tank: Tank;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SaleDetail, { eager: false, nullable: true })
  @JoinColumn({ name: 'sale_detail_id' })
  saleDetail: SaleDetail | null;

  @ManyToOne(() => DeliveryDetail, { eager: false, nullable: true })
  @JoinColumn({ name: 'delivery_detail_id' })
  deliveryDetail: DeliveryDetail | null;
}
