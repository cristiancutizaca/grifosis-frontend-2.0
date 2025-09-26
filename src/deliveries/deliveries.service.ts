import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { Delivery } from './entities/delivery.entity';

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Delivery)
    private deliveriesRepository: Repository<Delivery>,
  ) {}

  async create(createDeliveryDto: CreateDeliveryDto): Promise<Delivery> {
    const delivery = this.deliveriesRepository.create(createDeliveryDto);
    return await this.deliveriesRepository.save(delivery);
  }

  async findAll(): Promise<Delivery[]> {
    return await this.deliveriesRepository.find({
      relations: ['employee'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Delivery> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { delivery_id: id },
      relations: ['employee'],
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery #${id} not found`);
    }

    return delivery;
  }

  async update(id: number, updateDeliveryDto: UpdateDeliveryDto): Promise<Delivery> {
    const delivery = await this.findOne(id);
    Object.assign(delivery, updateDeliveryDto);
    return await this.deliveriesRepository.save(delivery);
  }

  async remove(id: number): Promise<void> {
    const delivery = await this.findOne(id);
    await this.deliveriesRepository.remove(delivery);
  }
}
