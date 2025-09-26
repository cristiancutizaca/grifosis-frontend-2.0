import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class ShiftDto {
  @IsNotEmpty({ message: 'El nombre del turno es obligatorio' })
  @IsString({ message: 'El nombre del turno debe ser una cadena de texto' })
  name: string;

  @IsNotEmpty({ message: 'La hora de inicio es obligatoria' })
  @IsString({ message: 'La hora de inicio debe ser una cadena de texto' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'El formato de la hora de inicio debe ser HH:MM (ej. 08:00)' })
  startTime: string;

  @IsNotEmpty({ message: 'La hora de fin es obligatoria' })
  @IsString({ message: 'La hora de fin debe ser una cadena de texto' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'El formato de la hora de fin debe ser HH:MM (ej. 17:00)' })
  endTime: string;
}


