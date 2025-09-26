import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreatePumpDto {
  @IsNotEmpty()
  @IsString()
  pump_number: string;

  @IsNotEmpty()
  @IsString()
  pump_name: string;

  @IsOptional()
  @IsString()
  location_description?: string;
}
