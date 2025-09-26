import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
  ) { }

  create(dto: CreateShiftDto) {
    const shift = this.shiftRepository.create({
      ...dto,
      openedBy: { user_id: dto.openedBy },
    });
    return this.shiftRepository.save(shift);
  }

  findAll() {
    return this.shiftRepository.find({
      relations: ['openedBy', 'closedBy'],
    });
  }

  async findOne(id: number) {
    const shift = await this.shiftRepository.findOne({
      where: { id },
      relations: ['openedBy', 'closedBy'],
    });

    if (!shift) {
      throw new NotFoundException(`Shift #${id} not found`);
    }

    return shift;
  }

  async update(id: number, dto: UpdateShiftDto) {
    return this.shiftRepository.update(id, {
      ...dto,
      openedBy: dto.openedBy ? { user_id: dto.openedBy } : undefined,
      closedBy: dto.closedBy ? { user_id: dto.closedBy } : undefined,
    });
  }


  remove(id: number) {
    return this.shiftRepository.delete(id);
  }
}
