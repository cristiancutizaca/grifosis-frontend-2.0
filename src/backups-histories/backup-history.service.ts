import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupHistory } from './entities/backup-history.entity';

@Injectable()
export class BackupHistoryService {
  constructor(
    @InjectRepository(BackupHistory)
    private readonly backupHistoryRepository: Repository<BackupHistory>,
  ) {}

  async create(data: Partial<BackupHistory>): Promise<BackupHistory> {
    const record = this.backupHistoryRepository.create(data);
    return this.backupHistoryRepository.save(record);
  }

  async findAll(): Promise<any[]> {
    const backups = await this.backupHistoryRepository.find({
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  
    return backups.map(backup => ({
      id: backup.id,
      filename: backup.filename,
      path: backup.path,
      created_at: backup.created_at,
      status: backup.status,
      type: backup.type,
      action: backup.action,
      user: backup.user
        ? {
            user_id: backup.user.user_id,
            username: backup.user.username,
            full_name: backup.user.full_name,
            role: backup.user.role,
          }
        : null,
    }));
  }

  async findOne(id: number): Promise<any | null> {
    const backup = await this.backupHistoryRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  
    if (!backup) {
      return null;
    }
  
    return {
      id: backup.id,
      filename: backup.filename,
      path: backup.path,
      created_at: backup.created_at,
      status: backup.status,
      type: backup.type,
      action: backup.action,
      user: backup.user
        ? {
            user_id: backup.user.user_id,
            username: backup.user.username,
            full_name: backup.user.full_name,
            role: backup.user.role,
          }
        : null,
    };
  }

  async getLastBackup(): Promise<any | null> {
    const backup = await this.backupHistoryRepository.findOne({
      where: {},
      order: { created_at: 'DESC' },
      relations: ['user'],
    });

    if (!backup) {
      throw new NotFoundException('No se encontró ningún backup');
    }

    // En caso se requiera más informción del último backcup, solo usar sus instancias
    return {
      id: backup.id,
      filename: "",
      path: "",
      created_at: backup.created_at,
      status: backup.status,
      type: backup.type,
      action: backup.action,
      user: backup.user
        ? {
            user_id: backup.user.user_id,
            username: "",
            full_name: "",
            role: "",
          }
        : null,
    };
  }
}
