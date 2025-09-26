import { PartialType } from '@nestjs/mapped-types';
import { CreatePumpTankDto } from './create-pump-tank.dto';

export class UpdatePumpTankDto extends PartialType(CreatePumpTankDto) {}
