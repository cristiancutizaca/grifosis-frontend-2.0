import { IsDateString, IsNumber } from 'class-validator';

export class CreateShiftDto {
  @IsDateString()
  startTime: Date;

  @IsNumber()
  initialAmount: number;

  @IsNumber()
  openedBy: number;
}
