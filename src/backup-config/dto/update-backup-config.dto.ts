import { PartialType } from '@nestjs/mapped-types';
import { CreateBackupConfigDto } from './create-backup-config.dto';

export class UpdateBackupConfigDto extends PartialType(CreateBackupConfigDto) {}
