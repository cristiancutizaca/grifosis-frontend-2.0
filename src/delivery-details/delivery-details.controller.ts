import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DeliveryDetailsService } from './delivery-details.service';
import { CreateDeliveryDetailDto } from './dto/create-delivery-detail.dto';
import { UpdateDeliveryDetailDto } from './dto/update-delivery-detail.dto';

@Controller('delivery-details')
export class DeliveryDetailsController {
  constructor(private readonly deliveryDetailsService: DeliveryDetailsService) {}

  @Post()
  create(@Body() createDeliveryDetailDto: CreateDeliveryDetailDto) {
    return this.deliveryDetailsService.create(createDeliveryDetailDto);
  }

  @Get()
  findAll() {
    return this.deliveryDetailsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deliveryDetailsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDeliveryDetailDto: UpdateDeliveryDetailDto) {
    return this.deliveryDetailsService.update(+id, updateDeliveryDetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deliveryDetailsService.remove(+id);
  }
}
