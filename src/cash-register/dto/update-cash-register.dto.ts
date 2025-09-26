import { PartialType } from '@nestjs/mapped-types';
import { CreateCashRegisterDto } from './create-cash-register.dto';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateCashRegisterDto extends PartialType(CreateCashRegisterDto) {
  @IsOptional()
  @IsNumber()
  closedBy?: number;

  @IsOptional()
  @IsNumber()
  closingAmount?: number;
}
