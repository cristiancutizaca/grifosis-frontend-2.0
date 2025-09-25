import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupConfig } from './entities/backup-config.entity';
import { CreateBackupConfigDto } from './dto/create-backup-config.dto';
import { UpdateBackupConfigDto } from './dto/update-backup-config.dto';

@Injectable()
export class BackupConfigService {
  constructor(
    @InjectRepository(BackupConfig)
    private readonly backupConfigRepository: Repository<BackupConfig>,
  ) {}

  async create(dto: CreateBackupConfigDto): Promise<BackupConfig> {
    // Desactivar los que estén activos o como default
    await this.backupConfigRepository
      .createQueryBuilder()
      .update(BackupConfig)
      .set({ is_default: false, is_active: false })
      .where("is_default = :isDefault OR is_active = :isActive", { isDefault: true, isActive: true })
      .execute();
  
    // Crear nuevo config como default + activo
    const config = this.backupConfigRepository.create({
      ...dto,
      is_default: true,
      is_active: true,
    });
  
    return this.backupConfigRepository.save(config);
  }  

  async findOne(id: number): Promise<BackupConfig> {
    const config = await this.backupConfigRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`BackupConfig con ID ${id} no encontrado`);
    }
    return config;
  }

  async findDefault(): Promise<BackupConfig> {
    const config = await this.backupConfigRepository.findOne({ where: { is_default: true } });
    if (!config) {
      throw new NotFoundException('No hay configuración de backup por defecto');
    }
    return config;
  }

  async update(id: number, dto: UpdateBackupConfigDto): Promise<BackupConfig> {
    const config = await this.findOne(id);

    // Si en la actualización se marca como default, desactivar los demás
    if (dto.is_default) {
      await this.backupConfigRepository.update({}, { is_default: false, is_active: false });
      config.is_default = true;
      config.is_active = true;
    }

    Object.assign(config, dto);
    return this.backupConfigRepository.save(config);
  }
}
