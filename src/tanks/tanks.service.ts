import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTankDto } from './dto/create-tank.dto';
import { UpdateTankDto } from './dto/update-tank.dto';
import { Tank } from './entities/tank.entity';

@Injectable()
export class TanksService {
  constructor(
    @InjectRepository(Tank)
    private readonly tankRepository: Repository<Tank>,
  ) {}

  async create(createTankDto: CreateTankDto): Promise<Tank> {
    const tank = this.tankRepository.create({
      ...createTankDto,
      total_capacity: createTankDto.total_capacity.toString(),
    });
    return await this.tankRepository.save(tank);
  }

  async findAll(): Promise<Tank[]> {
    return await this.tankRepository.find();
  }

  async findOne(id: number): Promise<Tank> {
    const tank = await this.tankRepository.findOneBy({ tank_id: id });
    if (!tank) throw new Error(`Tank #${id} not found`);
    return tank;
  }

  async update(id: number, updateTankDto: UpdateTankDto): Promise<Tank> {
    const updateData = {
      ...updateTankDto,
      total_capacity: updateTankDto.total_capacity ? updateTankDto.total_capacity.toString() : undefined,
    };
    await this.tankRepository.update(id, updateData);
    const updatedTank = await this.tankRepository.findOneBy({ tank_id: id });
    if (!updatedTank) throw new Error(`Tank #${id} not found`);
    return updatedTank;
  }

  async remove(id: number): Promise<void> {
    const result = await this.tankRepository.delete(id);
    if (result.affected === 0) throw new Error(`Tank #${id} not found`);
  }
}