import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNozzleDto } from './dto/create-nozzle.dto';
import { UpdateNozzleDto } from './dto/update-nozzle.dto';
import { Nozzle } from './entities/nozzle.entity';
import { Product } from '../products/entities/product.entity';

interface ProductoFrontend {
  id: number;
  nombre: string;
  precio: number;
  tipo: string;
}

interface FrontendNozzle {
  id: number;
  nozzle_id: number;
  pump_id: number;
  producto?: ProductoFrontend;
}

@Injectable()
export class NozzlesService {
  constructor(
    @InjectRepository(Nozzle)
    private readonly nozzleRepository: Repository<Nozzle>,
  ) {}

  private mapToFrontendFormat(nozzle: Nozzle): FrontendNozzle {
    // Asegura el tipado correcto del producto
    const product = nozzle.product as (Product & {
      product_id: number;
      name: string;
      unit_price: number;
      fuel_type: string;
    }) | undefined;

    const result: FrontendNozzle = {
      id: nozzle.nozzle_id,
      nozzle_id: nozzle.nozzle_id,
      pump_id: nozzle.pump ? nozzle.pump.pump_id : nozzle.pump_id
    };

    if (product) {
      result.producto = {
        id: product.product_id,
        nombre: product.name,
        precio: Number(product.unit_price),
        tipo: product.fuel_type || 'regular'
      };
    }

    return result;
  }

  async create(createNozzleDto: CreateNozzleDto): Promise<Nozzle> {
    const existente = await this.nozzleRepository.findOne({
      where: { nozzle_number: createNozzleDto.nozzle_number },
    });
    if (existente) {
      throw new Error(
        `Ya existe un dispensador con el número ${createNozzleDto.nozzle_number}. El número de dispensador (nozzle_number) debe ser único.`
      );
    }

    const nozzle = this.nozzleRepository.create({
      ...createNozzleDto,
      pump_id: createNozzleDto.pump_id,
      product_id: createNozzleDto.product_id,
      tank_id: createNozzleDto.tank_id,
    });
    return await this.nozzleRepository.save(nozzle);
  }

  async findAll(): Promise<Nozzle[]> {
    return await this.nozzleRepository.find({ relations: ['pump', 'product', 'tank'] });
  }

  async findOne(id: number): Promise<Nozzle> {
    const nozzle = await this.nozzleRepository.findOne({
      where: { nozzle_id: id },
      relations: ['pump', 'product', 'tank'],
    });
    if (!nozzle) {
      throw new NotFoundException(`Nozzle #${id} not found`);
    }
    return nozzle;
  }

  async update(id: number, dto: UpdateNozzleDto) {
    await this.nozzleRepository.update(id, {
      ...dto,
      pump: { pump_id: dto.pump_id },
      tank: { tank_id: dto.tank_id },
    });
    return this.nozzleRepository.findOne({
      where: { nozzle_id: id },
      relations: ["pump", "tank", "product"],
    });
  }

  async remove(id: number): Promise<void> {
    const result = await this.nozzleRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Nozzle #${id} not found`);
    }
  }

  async findByPump(pumpId: number): Promise<Nozzle[]> {
    return await this.nozzleRepository.find({
      where: { pump_id: pumpId },
      relations: ['pump', 'product', 'tank'],
    });
  }

  async findActiveNozzles(): Promise<Nozzle[]> {
    return await this.nozzleRepository.find({ 
      where: { estado: 'activo' }, // Es buena práctica filtrar también por el estado
      relations: ['pump', 'product', 'tank'] // Se añade la relación con 'pump'
    });
  }

  async getPumps(): Promise<number[]> {
    const pumps = await this.nozzleRepository
      .createQueryBuilder('nozzle')
      .select('DISTINCT nozzle.pump_id')
      .getRawMany();
    return pumps.map((p) => p.pump_id);
  }

  // Métodos optimizados para el frontend

  async getNozzlesByPump(pumpId: number): Promise<FrontendNozzle[]> {
    const nozzles = await this.nozzleRepository.find({
      where: { pump_id: pumpId },
      relations: ['product', 'pump'], // Incluye las relaciones necesarias
    });

    return nozzles.map(this.mapToFrontendFormat.bind(this));
  }

  // CÓDIGO CORREGIDO
  async getActiveNozzles(): Promise<FrontendNozzle[]> {
    const nozzles = await this.nozzleRepository.find({
      where: { estado: 'activo' }, // Se añade el filtro por estado activo
      relations: ['product', 'pump'], // Se añade la relación con 'pump'
    });

    return nozzles.map(this.mapToFrontendFormat.bind(this));
  }
}