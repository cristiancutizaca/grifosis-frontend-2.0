import { IsArray, IsNumber, ArrayNotEmpty, IsInt } from 'class-validator';

export class CreatePumpTankDto {
  @IsNumber()
  pump_id: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  tank_ids: number[];
}
