import { IsOptional, IsString, IsEmail, Matches, Length, isArray, IsArray, IsObject, IsInt, Min, Max } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsString({ message: 'El nombre de la empresa debe ser una cadena de texto' })
  @Length(1, 255, { message: 'El nombre de la empresa debe tener entre 1 y 255 caracteres' })
  company_name?: string;

  @IsOptional()
  @IsString({ message: 'El RUC debe ser una cadena de texto' })
  @Matches(/^[0-9]{11}$/, { 
    message: 'El RUC debe tener exactamente 11 dígitos numéricos' 
  })
  company_ruc?: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser una cadena de texto' })
  @Length(1, 500, { message: 'La dirección debe tener entre 1 y 500 caracteres' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @Matches(/^[0-9]{9}$/, { 
    message: 'El teléfono debe tener exactamente 9 dígitos numéricos' 
  })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  @Length(1, 100, { message: 'El email debe tener entre 1 y 100 caracteres' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'La dirección web debe ser una cadena de texto' })
  @Length(1, 255, { message: 'La dirección web debe tener entre 1 y 255 caracteres' })
  web_address?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  social_networks?: string[];

  @IsOptional()
  @IsString({ message: 'La ruta del logo debe ser una cadena de texto' })
  logo?: string;

  @IsOptional()
  @IsObject({ message: 'Los horarios deben ser un objeto JSON' })
  shift_hours?: Record<string, string>;

  @IsOptional()
  @IsString()
  payment_methods?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString({ message: 'La ruta de facturas debe ser una cadena de texto' })
  invoices?: string;

  @IsOptional()
  @IsString({ message: 'La ruta de backup debe ser una cadena de texto' })
  backup_path?: string;
}

