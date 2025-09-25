import { Injectable } from '@nestjs/common';
import { CreateDeliveryDetailDto } from './dto/create-delivery-detail.dto';
import { UpdateDeliveryDetailDto } from './dto/update-delivery-detail.dto';

@Injectable()
export class DeliveryDetailsService {
  create(createDeliveryDetailDto: CreateDeliveryDetailDto) {
    return 'This action adds a new deliveryDetail';
  }

  findAll() {
    return `This action returns all deliveryDetails`;
  }

  findOne(id: number) {
    return `This action returns a #${id} deliveryDetail`;
  }

  update(id: number, updateDeliveryDetailDto: UpdateDeliveryDetailDto) {
    return `This action updates a #${id} deliveryDetail`;
  }

  remove(id: number) {
    return `This action removes a #${id} deliveryDetail`;
  }
}
