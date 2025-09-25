import { IsString, IsNotEmpty, IsOptional, IsBoolean, ValidateIf, IsInt, Min } from 'class-validator';

export class CreateUserDto {
  @IsString() @IsNotEmpty()
  username: string;

  @IsString() @IsNotEmpty()
  password: string;

  @IsString() @IsNotEmpty()
  role: 'superadmin' | 'admin' | 'seller';

  @IsOptional()
  full_name?: string;

  @IsOptional()
  permissions?: any;

  @IsOptional() @IsBoolean()
  is_active?: boolean;

  @ValidateIf(o => o.role === 'seller')
  @IsInt() @Min(1)
  employee_id?: number;
}
