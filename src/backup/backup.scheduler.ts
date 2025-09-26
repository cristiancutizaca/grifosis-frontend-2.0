import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupConfigService } from '../backup-config/backup-config.service';
import { BackupService } from './backup.service';
import { BackupType } from '../backups-histories/constants/backup-history.contants';
import { BackupFrequency } from '../backup-config/constants/backup.constants';

@Injectable()
export class BackupScheduler {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(
    private readonly backupConfigService: BackupConfigService,
    private readonly backupService: BackupService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    try {
      const config = await this.backupConfigService.findDefault();

      if (!config.is_active) return;

      // Normalizar hora
      const now = new Date();
      const [hour, minute] = config.time_of_day.split(':').map(Number);

      if (now.getHours() !== hour || now.getMinutes() !== minute) return;

      // Normalizar frecuencia
      const freq = this.normalizeFrequency(config.frequency);
      let shouldRun = false;

      switch (freq) {
        case BackupFrequency.DAILY:
          shouldRun = true;
          break;
        case BackupFrequency.WEEKLY:
          shouldRun = now.getDay() === config.day_of_week;
          break;
        case BackupFrequency.MONTHLY:
          shouldRun = now.getDate() === config.day_of_month;
          break;
        case BackupFrequency.YEARLY:
          const currentMonth = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
          shouldRun =
            config.specific_day !== undefined &&
            config.month !== undefined &&
            now.getDate() === config.specific_day &&
            currentMonth === config.month.toUpperCase();
          break;
        case BackupFrequency.DISABLED:
          shouldRun = false;
          break;
      }

      if (shouldRun) {
        this.logger.log(`Ejecutando backup automático [${config.storage_type}]`);
        await this.backupService.createBackup(
          null,
          config.storage_type,
          BackupType.AUTOMATIC,
        );
      }
    } catch (error) {
      this.logger.error(`Error en BackupScheduler: ${error.message}`);
    }
  }

  private normalizeFrequency(freq: string): BackupFrequency {
    switch (freq.toLowerCase()) {
      case 'diario':
        return BackupFrequency.DAILY;
      case 'semanal':
        return BackupFrequency.WEEKLY;
      case 'mensual':
        return BackupFrequency.MONTHLY;
      case 'anual':
        return BackupFrequency.YEARLY;
      case 'desactivado':
        return BackupFrequency.DISABLED;
      default:
        return BackupFrequency.DISABLED;
    }
  }
}
