import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashRegister } from './entities/cash-register.entity';
import { CreateCashRegisterDto } from './dto/create-cash-register.dto';
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';

@Injectable()
export class CashRegisterService {
  constructor(
    @InjectRepository(CashRegister)
    private readonly cashRegisterRepo: Repository<CashRegister>,
  ) {}

  create(dto: CreateCashRegisterDto) {
    const entity = this.cashRegisterRepo.create({
      ...dto,
      shift: { id: dto.shiftId },
      openedBy: { id: dto.openedBy },
    });
    return this.cashRegisterRepo.save(entity);
  }

  findAll() {
    return this.cashRegisterRepo.find({
      relations: ['shift', 'openedBy', 'closedBy'],
    });
  }

  async findOne(id: number) {
    const register = await this.cashRegisterRepo.findOne({
      where: { id },
      relations: ['shift', 'openedBy', 'closedBy'],
    });

    if (!register) {
      throw new NotFoundException(`Cash register #${id} not found`);
    }

    return register;
  }

  async update(id: number, dto: UpdateCashRegisterDto) {
    const updated = await this.cashRegisterRepo.preload({
      id,
      ...dto,
      shift: dto.shiftId ? { id: dto.shiftId } : undefined,
      closedBy: dto.closedBy ? { id: dto.closedBy } : undefined,
    });

    if (!updated) {
      throw new NotFoundException(`Cash register #${id} not found`);
    }

    return this.cashRegisterRepo.save(updated);
  }

  remove(id: number) {
    return this.cashRegisterRepo.delete(id);
  }
}
