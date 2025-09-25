import { IsNumber } from 'class-validator';

export class CreateCashRegisterDto {
  @IsNumber()
  shiftId: number;

  @IsNumber()
  openedBy: number;

  @IsNumber()
  openingAmount: number;
}
