import { Module } from '@nestjs/common';
import { DeliveryDetailsService } from './delivery-details.service';
import { DeliveryDetailsController } from './delivery-details.controller';

@Module({
  controllers: [DeliveryDetailsController],
  providers: [DeliveryDetailsService],
})
export class DeliveryDetailsModule {}
