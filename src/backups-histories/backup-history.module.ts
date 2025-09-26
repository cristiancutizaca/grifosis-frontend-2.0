import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupHistory } from './entities/backup-history.entity';
import { BackupHistoryService } from './backup-history.service';
import { BackupHistoryController } from './backup-history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BackupHistory])],
  controllers: [BackupHistoryController],
  providers: [BackupHistoryService],
  exports: [BackupHistoryService],
})
export class BackupHistoryModule {}
