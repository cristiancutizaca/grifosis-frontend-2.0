import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { BackupHistoryService } from './backup-history.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { BackupHistory } from './entities/backup-history.entity';
import { Role } from 'src/auth/roles.enum';

@Controller('backups-histories')
export class BackupHistoryController {
  constructor(private readonly backupHistoryService: BackupHistoryService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get()
  async getAll() {
    return this.backupHistoryService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Get('last')
  async getLastBackup(): Promise<BackupHistory> {
    return this.backupHistoryService.getLastBackup();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const backup = await this.backupHistoryService.findOne(Number(id));
    if (!backup) {
      throw new NotFoundException(`Backup con id ${id} no encontrado`);
    }
    return backup;
  }
}
