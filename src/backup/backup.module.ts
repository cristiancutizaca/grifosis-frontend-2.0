import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupHistoryModule } from '../backups-histories/backup-history.module';
import { BackupScheduler } from './backup.scheduler';
import { BackupConfigModule } from 'src/backup-config/backup-config.module';
import { LocalStrategy } from './estrategies/local.strategy';
import { S3Strategy } from './estrategies/s3.strategy';
import { GDriveStrategy } from './estrategies/gdrive.strategy';

@Module({
  imports: [
    BackupHistoryModule, 
    BackupConfigModule
  ],
  controllers: [BackupController],
  providers: [
    BackupService, 
    BackupScheduler,
    LocalStrategy,
    S3Strategy,
    GDriveStrategy
  ],
  exports: [BackupService],
})
export class BackupModule {}
