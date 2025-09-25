import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePumpDto } from './dto/create-pump.dto';
import { UpdatePumpDto } from './dto/update-pump.dto';
import { Pump } from './entities/pump.entity';

@Injectable()
export class PumpsService {
  constructor(
    @InjectRepository(Pump)
    private readonly pumpRepository: Repository<Pump>,
  ) {}

  async create(createPumpDto: CreatePumpDto): Promise<Pump> {
    const pump = this.pumpRepository.create(createPumpDto);
    return await this.pumpRepository.save(pump);
  }

  async findAll(): Promise<Pump[]> {
    return await this.pumpRepository.find({ relations: ['nozzles'] });
  }

  async findOne(id: number): Promise<Pump> {
    const pump = await this.pumpRepository.findOne({
      where: { pump_id: id },
      relations: ['nozzles'],
    });
    if (!pump) {
      throw new NotFoundException(`Pump #${id} not found`);
    }
    return pump;
  }

  async update(id: number, updatePumpDto: UpdatePumpDto): Promise<Pump> {
    const pump = await this.findOne(id);
    Object.assign(pump, updatePumpDto);
    return await this.pumpRepository.save(pump);
  }

  async remove(id: number): Promise<void> {
    const result = await this.pumpRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Pump #${id} not found`);
    }
  }

  async getProductsForPump(pumpId: number) {
    const pump = await this.pumpRepository.findOne({
      where: { pump_id: pumpId },
      relations: ['tankConnections', 'tankConnections.tank', 'tankConnections.tank.product'],
    });

    if (!pump) {
      throw new NotFoundException('Surtidor no encontrado');
    }

    const products = pump.tankConnections
      ?.map(pt => pt.tank?.product)
      .filter(p => p !== undefined) || [];

    const uniqueProducts = products.filter(
      (p, index, self) => index === self.findIndex(prod => prod.product_id === p.product_id),
    );

    return uniqueProducts;
  }

  async getProductsForAllPumps() {
    const pumps = await this.pumpRepository.find({
      relations: [
        'tankConnections',
        'tankConnections.tank',
        'tankConnections.tank.product'
      ]
    });
  
    return pumps.map(pump => ({
      pump_id: pump.pump_id,
      pump_name: pump.pump_name,
      products: pump.tankConnections
        ?.map(tc => tc.tank?.product)
        .filter(p => p !== undefined) || []
    }));
  }  
}
