import { IsString, IsNumber, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  category: string;

  @IsNumber()
  amount: number;

  @IsDateString()
  expense_date: string;

  @IsBoolean()
  @IsOptional()
  is_recurring?: boolean;

  @IsString()
  @IsOptional()
  receipt_file?: string;
}
