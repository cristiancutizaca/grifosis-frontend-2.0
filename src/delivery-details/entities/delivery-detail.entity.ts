import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Delivery } from '../../deliveries/entities/delivery.entity';
import { Product } from '../../products/entities/product.entity';
import { Tank } from '../../tanks/entities/tank.entity';
import { StockMovement } from '../../stock-movements/entities/stock-movement.entity';

@Entity('delivery_details')
export class DeliveryDetail {
  @PrimaryGeneratedColumn()
  delivery_detail_id: number;

  @ManyToOne(() => Delivery, (delivery) => delivery.deliveryDetails, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'delivery_id' })
  delivery: Delivery;

  @ManyToOne(() => Product, (product) => product.deliveryDetails, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Tank, (tank) => tank.deliveryDetails, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tank_id' })
  tank: Tank;

  @Column('decimal', { precision: 10, scale: 3, nullable: false })
  quantity_delivered: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  unit_cost: number;

  @OneToMany(
    () => StockMovement,
    (stockMovement) => stockMovement.deliveryDetail,
  )
  stockMovements: StockMovement[];
}
