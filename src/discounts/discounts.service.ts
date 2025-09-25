import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discount } from './entities/discount.entity';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(Discount)
    private readonly discountRepository: Repository<Discount>,
  ) {}

  create(dto: CreateDiscountDto) {
    const discount = this.discountRepository.create({
      ...dto,
      active: dto.active ?? true,
    });
    return this.discountRepository.save(discount);
  }

  findAll() {
    return this.discountRepository.find();
  }

  async findOne(id: number) {
    const discount = await this.discountRepository.findOne({
      where: { id },
    });

    if (!discount) {
      throw new NotFoundException(`Discount #${id} not found`);
    }

    return discount;
  }

  async update(id: number, dto: UpdateDiscountDto) {
    const updated = await this.discountRepository.preload({
      id,
      ...dto,
    });

    if (!updated) {
      throw new NotFoundException(`Discount #${id} not found`);
    }

    return this.discountRepository.save(updated);
  }

  async remove(id: number): Promise<void> {
    const result = await this.discountRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Discount #${id} not found`);
    }
  }
}
