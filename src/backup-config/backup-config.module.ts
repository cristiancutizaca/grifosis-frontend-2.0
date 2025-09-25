import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupConfigService } from './backup-config.service';
import { BackupConfigController } from './backup-config.controller';
import { BackupConfig } from './entities/backup-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BackupConfig])],
  controllers: [BackupConfigController],
  providers: [BackupConfigService],
  exports: [BackupConfigService],
})
export class BackupConfigModule {}
