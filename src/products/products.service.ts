import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from '../entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create(createProductDto);
    return await this.productsRepository.save(product);
  }

  async findAll(): Promise<Product[]> {
    return await this.productsRepository.find({
      order: { name: 'ASC' }
    });
  }

  async findActive(): Promise<Product[]> {
    return await this.productsRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' }
    });
  }

  async findByCategory(category: string): Promise<Product[]> {
    return await this.productsRepository.find({
      where: { category, is_active: true },
      order: { name: 'ASC' }
    });
  }

  async findByFuelType(fuelType: string): Promise<Product[]> {
    return await this.productsRepository.find({
      where: { fuel_type: fuelType, is_active: true },
      order: { name: 'ASC' }
    });
  }

  async search(searchTerm: string): Promise<Product[]> {
    return await this.productsRepository.find({
      where: [
        { name: Like(`%${searchTerm}%`) },
        { description: Like(`%${searchTerm}%`) }
      ],
      order: { name: 'ASC' }
    });
  }

  async findOne(id: number): Promise<Product | null> {
    return await this.productsRepository.findOne({
      where: { product_id: id }
    });
  }

  async update(id: number, updateProductDto: UpdateProductDto): Promise<Product | null> {
    await this.productsRepository.update({ product_id: id }, updateProductDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.productsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Producto no encontrado');
    }
  }

  async deactivate(id: number): Promise<Product | null> {
    await this.productsRepository.update(id, { is_active: false });
    return this.findOne(id);
  }

  async activate(id: number): Promise<Product | null> {
    await this.productsRepository.update(id, { is_active: true });
    return this.findOne(id);
  }

  async getProductStats(): Promise<any> {
    const total = await this.productsRepository.count();
    const active = await this.productsRepository.count({ where: { is_active: true } });
    const inactive = total - active;

    const categories = await this.productsRepository
      .createQueryBuilder('product')
      .select('product.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('product.is_active = :active', { active: true })
      .groupBy('product.category')
      .getRawMany();

    return {
      total,
      active,
      inactive,
      categories
    };
  }

  async getKardex(productId: number, startDate?: string, endDate?: string): Promise<any> {
    const product = await this.findOne(productId);
    if (!product) {
      throw new Error('Producto no encontrado');
    }

    // Obtener movimientos de stock del producto
    const query = this.productsRepository.manager
      .createQueryBuilder()
      .select([
        'sm.movement_id',
        'sm.movement_type',
        'sm.quantity',
        'sm.unit_cost',
        'sm.total_cost',
        'sm.reference_type',
        'sm.reference_id',
        'sm.notes',
        'sm.created_at'
      ])
      .from('stock_movements', 'sm')
      .where('sm.product_id = :productId', { productId });

    if (startDate && endDate) {
      query.andWhere('sm.created_at BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });
    }

    query.orderBy('sm.created_at', 'ASC');

    const movements = await query.getRawMany();

    // Calcular saldos acumulados
    let runningBalance = 0;
    let runningValue = 0;

    const kardexEntries = movements.map(movement => {
      const quantity = Number(movement.quantity);
      const unitCost = Number(movement.unit_cost || 0);
      
      if (movement.movement_type === 'entrada') {
        runningBalance += quantity;
        runningValue += Number(movement.total_cost || 0);
      } else {
        runningBalance -= quantity;
        runningValue -= Number(movement.total_cost || 0);
      }

      const averageCost = runningBalance > 0 ? runningValue / runningBalance : 0;

      return {
        date: movement.created_at,
        reference: `${movement.reference_type}-${movement.reference_id}`,
        description: movement.notes || movement.movement_type,
        entrada: movement.movement_type === 'entrada' ? quantity : 0,
        salida: movement.movement_type === 'salida' ? quantity : 0,
        saldo: runningBalance,
        costoUnitario: unitCost,
        costoPromedio: averageCost,
        valorTotal: runningBalance * averageCost
      };
    });

    return {
      product: {
        id: product.product_id,
        name: product.name,
        category: product.category,
        unit: product.unit
      },
      period: startDate && endDate ? { startDate, endDate } : null,
      kardex: kardexEntries,
      summary: {
        totalMovements: movements.length,
        currentStock: runningBalance,
        currentValue: runningBalance * (kardexEntries[kardexEntries.length - 1]?.costoPromedio || 0)
      }
    };
  }
}
