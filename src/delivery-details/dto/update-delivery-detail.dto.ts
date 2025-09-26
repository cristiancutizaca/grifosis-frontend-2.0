import { PartialType } from '@nestjs/mapped-types';
import { CreateDeliveryDetailDto } from './create-delivery-detail.dto';

export class UpdateDeliveryDetailDto extends PartialType(CreateDeliveryDetailDto) {}
