import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { BackupService } from './backup.service';
import { BackupType } from 'src/backups-histories/constants/backup-history.contants';
import * as path from 'path';
import { Response } from 'express';
import { BackupConfigService } from 'src/backup-config/backup-config.service';
import { StorageType } from 'src/backup-config/constants/backup.constants';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from 'src/auth/roles.enum';

@Controller('backup')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly backupConfigService: BackupConfigService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post('backup')
  async createBackup(@Req() req) {
    const userId = req.user.userId;
    const config = await this.backupConfigService.findDefault();

    return await this.backupService.createBackup(
      userId,
      config.storage_type as StorageType,
      BackupType.MANUAL,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('database-info')
  getDatabaseInfo() {
    return this.backupService.getDatabaseInfo();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('download/:id')
  async downloadBackup(@Param('id') id: string, @Res() res: Response) {
    const backupPath = await this.backupService.getBackupFilePath(Number(id));
    const filename = path.basename(backupPath);
    return res.download(backupPath, filename);
  }
}
