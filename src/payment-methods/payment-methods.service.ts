import { Injectable, NotFoundException  } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from './entities/payment-method.entity';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
  ) {}

  async create(dto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    const newMethod = this.paymentMethodRepo.create(dto);
    return this.paymentMethodRepo.save(newMethod);
  }

  findAll(): Promise<PaymentMethod[]> {
    return this.paymentMethodRepo.find({ order: { payment_method_id: 'ASC' } });
  }

  async findOne(id: string) {
    const method = await this.paymentMethodRepo.findOne({ where: { payment_method_id: parseInt(id) } });
    if(!method) {
      throw new NotFoundException(`Payment method with ID ${id} not found`);
    }
    return method;
  }

  async update(id: string, dto: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    const method = await this.findOne(id);
    const updated = Object.assign(method, dto);
    return this.paymentMethodRepo.save(updated);
  }

  async remove(id: string): Promise<void> {
    const method = await this.findOne(id);
    await this.paymentMethodRepo.remove(method);
  }

  async findAllActive(): Promise<PaymentMethod[]> {
    return this.paymentMethodRepo.find({
      where: { is_active: true },
      order: { payment_method_id: 'ASC' },
    });
  }    
}
