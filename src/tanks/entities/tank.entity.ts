import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { PumpTank } from 'src/PumpsTanks/entities/pump-tank.entity';
import { DeliveryDetail } from 'src/delivery-details/entities/delivery-detail.entity';
import { StockMovement } from 'src/stock-movements/entities/stock-movement.entity';

@Entity('tanks')
export class Tank {
  @PrimaryGeneratedColumn('increment')
  tank_id: number;

  @Column({ type: 'varchar', length: 40, unique: true, nullable: false })
  tank_name: string;

  @Column({ type: 'int', nullable: false })
  product_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: false })
  total_capacity: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true, default: 0 })
  current_stock: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ type: 'text', nullable: true })
  description: string;

 @Column({
  type: 'timestamp',
  default: () => 'CURRENT_TIMESTAMP',
  nullable: false,
})
created_at: Date;


  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // Getters para compatibilidad con reportes
  get name(): string {
    return this.tank_name;
  }

  get capacity(): string {
    return this.total_capacity;
  }

  // tank.entity.ts
  @OneToMany(() => PumpTank, (pumpTank) => pumpTank.tank)
  pumpConnections: PumpTank[];

  @OneToMany(() => DeliveryDetail, (deliveryDetail) => deliveryDetail.product)
  deliveryDetails: DeliveryDetail[];

  @OneToMany(() => StockMovement, (stockMovement) => stockMovement.tank)
  stockMovements: StockMovement[];
}
 