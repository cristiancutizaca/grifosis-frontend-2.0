import { PartialType } from '@nestjs/mapped-types';
import { CreatePumpDto } from './create-pump.dto';

export class UpdatePumpDto extends PartialType(CreatePumpDto) {}
