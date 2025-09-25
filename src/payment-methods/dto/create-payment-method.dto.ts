import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreatePaymentMethodDto {
    @IsString()
    @Length(1, 50)
    method_name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
