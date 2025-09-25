import { IsNotEmpty, IsString, IsEmail, Matches, Length, IsOptional } from 'class-validator';

export class CreateSettingDto {
  @IsNotEmpty({ message: 'El nombre de la empresa es obligatorio' })
  @IsString({ message: 'El nombre de la empresa debe ser una cadena de texto' })
  @Length(1, 255, { message: 'El nombre de la empresa debe tener entre 1 y 255 caracteres' })
  @IsOptional()
  company_name: string;

  @IsNotEmpty({ message: 'El RUC es obligatorio' })
  @IsString({ message: 'El RUC debe ser una cadena de texto' })
  @Matches(/^[0-9]{11}$/, { 
    message: 'El RUC debe tener exactamente 11 dígitos numéricos' 
  })
  company_ruc: string;

  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @IsString({ message: 'La dirección debe ser una cadena de texto' })
  @Length(1, 500, { message: 'La dirección debe tener entre 1 y 500 caracteres' })
  address: string;

  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @Matches(/^[0-9]{9}$/, { 
    message: 'El teléfono debe tener exactamente 9 dígitos numéricos' 
  })
  phone: string;

  @IsNotEmpty({ message: 'El email es obligatorio' })
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  @Length(1, 100, { message: 'El email debe tener entre 1 y 100 caracteres' })
  email: string;
}

