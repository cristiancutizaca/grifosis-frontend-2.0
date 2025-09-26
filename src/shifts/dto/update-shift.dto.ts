import { PartialType } from '@nestjs/mapped-types';
import { CreateShiftDto } from './create-shift.dto';
import { IsDateString, IsNumber, IsOptional } from 'class-validator';

export class UpdateShiftDto extends PartialType(CreateShiftDto) {
  @IsOptional()
  @IsNumber()
  closedBy?: number;

  @IsOptional()
  @IsNumber()
  finalAmount?: number;

  @IsOptional()
  @IsDateString()
  endTime?: Date;
}
