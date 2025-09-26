import { PartialType } from '@nestjs/mapped-types';
import { CreateNozzleDto } from './create-nozzle.dto';

export class UpdateNozzleDto extends PartialType(CreateNozzleDto) {}