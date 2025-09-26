import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovement } from './entities/stock-movement.entity';
import { Tank } from '../tanks/entities/tank.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { SaleDetail } from '../sale-details/entities/sale-detail.entity'
import { DeliveryDetail } from '../delivery-details/entities/delivery-detail.entity'

@Injectable()
export class StockMovementsService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(Tank)
    private readonly tankRepository: Repository<Tank>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createStockMovementDto: CreateStockMovementDto) {
    const { tank_id, product_id, user_id, sale_detail_id, delivery_detail_id, quantity, movement_type } = createStockMovementDto;

    // Verificar que el tanque existe
    const tank = await this.tankRepository.findOne({ where: { tank_id } });
    if (!tank) throw new NotFoundException('El tanque especificado no existe.');

    // Verificar que el producto existe
    const product = await this.dataSource.getRepository(Product).findOne({ where: { product_id } });
    if (!product) throw new NotFoundException('El producto especificado no existe.');

    // Verificar que el usuario existe
    const user = await this.dataSource.getRepository(User).findOne({ where: { user_id } });
    if (!user) throw new NotFoundException('El usuario especificado no existe.');

    // Verificar sale_detail_id si existe
    let saleDetail: SaleDetail | null = null;
    if (sale_detail_id) {
      const foundSaleDetail = await this.dataSource.getRepository(SaleDetail).findOne({ where: { sale_detail_id } });
      if (!foundSaleDetail) throw new NotFoundException('El detalle de venta especificado no existe.');
      saleDetail = foundSaleDetail;
    }

    // Verificar delivery_detail_id si existe
    let deliveryDetail: DeliveryDetail | null = null;
    if (delivery_detail_id) {
      const foundSaleDetail = await this.dataSource.getRepository(DeliveryDetail).findOne({ where: { delivery_detail_id } });
      if (!foundSaleDetail) throw new NotFoundException('El detalle de entrega especificado no existe.');
      deliveryDetail = foundSaleDetail;
    }

    const currentStock = Number(tank.current_stock ?? 0);
    const totalCapacity = Number(tank.total_capacity);
    const qty = Number(quantity);
  
    // Validar stock disponible para salida
    if (movement_type === 'Salida' && qty > currentStock) {
      throw new BadRequestException('Stock insuficiente para realizar la salida.');
    }
  
    // Validar capacidad máxima para entrada
    if (movement_type === 'Entrada' && currentStock + qty > totalCapacity) {
      throw new BadRequestException('No se puede sobrepasar la capacidad máxima del tanque.');
    }
  
    // Crear movimiento
    const movement = this.stockMovementRepository.create({
      ...createStockMovementDto,
      tank,
      product,
      user,
      saleDetail,
      deliveryDetail,
    });
  
    await this.stockMovementRepository.save(movement);
  
    // Actualizar stock del tanque
    tank.current_stock = movement_type === 'Entrada'
      ? (currentStock + qty).toFixed(3)
      : (currentStock - qty).toFixed(3);
  
    await this.tankRepository.save(tank);
  
    return movement;
  }

  async getAll(): Promise<StockMovement[]> {
      return await this.stockMovementRepository.find();
  }
}
