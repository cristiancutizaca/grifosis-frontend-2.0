import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BackupConfigService } from './backup-config.service';
import { CreateBackupConfigDto } from './dto/create-backup-config.dto';
import { UpdateBackupConfigDto } from './dto/update-backup-config.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from 'src/auth/roles.enum';

@Controller('backup-config')
export class BackupConfigController {
  constructor(private readonly backupConfigService: BackupConfigService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post()
  create(@Body() dto: CreateBackupConfigDto) {
    return this.backupConfigService.create(dto);
  }

  /*@UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.backupConfigService.findAll();
  }*/

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('default')
  findDefault() {
    return this.backupConfigService.findDefault();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBackupConfigDto) {
    return this.backupConfigService.update(+id, dto);
  }
}
