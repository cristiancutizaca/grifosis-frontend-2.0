import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { BackupFrequency, StorageType } from '../constants/backup.constants';

export class CreateBackupConfigDto {
  @IsString()
  @IsIn(Object.values(BackupFrequency))
  frequency: BackupFrequency;

  @IsString()
  @IsNotEmpty()
  time_of_day: string;

  @IsOptional()
  @IsInt()
  day_of_week?: number;

  @IsOptional()
  @IsInt()
  day_of_month?: number;

  @IsOptional()
  @IsInt()
  specific_day?: number;

  @IsOptional()
  @IsString()
  month?: string;

  @IsString()
  @IsIn(Object.values(StorageType))
  storage_type: StorageType;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
