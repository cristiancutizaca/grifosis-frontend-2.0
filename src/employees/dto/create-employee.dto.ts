import { IsString, IsNotEmpty, IsOptional, IsEmail, IsDateString, IsBoolean } from 'class-validator'; // Importa IsBoolean

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty({ message: 'El DNI no puede estar vacío' })
  dni: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  first_name: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido no puede estar vacío' })
  last_name: string;

  @IsString()
  @IsNotEmpty({ message: 'La posición no puede estar vacía' })
  position: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'La fecha de nacimiento debe ser una fecha válida en formato YYYY-MM-DD' })
  birth_date?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email debe ser una dirección de correo válida' })
  email?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'La fecha de contratación debe ser una fecha válida en formato YYYY-MM-DD' })
  hire_date?: string;

  @IsOptional()
  @IsBoolean({ message: 'El estado activo/inactivo debe ser un valor booleano' }) // NUEVO: Añade esta validación
  is_active?: boolean;
}
