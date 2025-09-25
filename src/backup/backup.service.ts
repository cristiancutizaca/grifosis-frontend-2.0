import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { exec, exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { BackupHistoryService } from '../backups-histories/backup-history.service';
import { BackupType, BackupStatus, BackupAction } from 'src/backups-histories/constants/backup-history.contants';
import { StorageType } from 'src/backup-config/constants/backup.constants';
import { LocalStrategy } from './estrategies/local.strategy';
import { S3Strategy } from './estrategies/s3.strategy';
import { GDriveStrategy } from './estrategies/gdrive.strategy';

const execAsync = promisify(execCallback);

@Injectable()
export class BackupService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly backupHistoryService: BackupHistoryService,
    private readonly localStrategy: LocalStrategy,
    private readonly s3Strategy: S3Strategy,
    private readonly gdriveStrategy: GDriveStrategy,
  ) {}

  async createBackup(userId: number | null, storageType: StorageType, type: BackupType = BackupType.MANUAL) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueId = randomUUID().slice(0, 8);
    const filename = `grifosis_${type}_${BackupAction.BACKUP}_${timestamp}_${uniqueId}.dump`;

    const tempDir = process.env.BACKUP_TMP_DIR ?? 'var/backups/grifosis/tmp';
    const tempPath = path.join(tempDir, filename);

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      // Crear backup en directorio temporal
      const dbConfig = this.dataSource.options as any;
      const command = `pg_dump \
        -h ${dbConfig.host} \
        -p ${dbConfig.port} \
        -U ${dbConfig.username} \
        -d ${dbConfig.database} \
        -Fc \
        -f "${tempPath}" \
        --no-password`;

      const env = { ...process.env, PGPASSWORD: dbConfig.password };
      await execAsync(command, { env });

      // Decidir dónde guardar según storageType
      let finalPath: string;

      switch (storageType) {
        case StorageType.LOCAL:
          finalPath = await this.localStrategy.save(tempPath, filename);
          break;
        case StorageType.S3:
          finalPath = await this.s3Strategy.save(tempPath, filename);
          break;
        case StorageType.GDRIVE:
          finalPath = await this.gdriveStrategy.save(tempPath, filename);
          break;
        default:
          throw new BadRequestException(`Tipo de almacenamiento no soportado: ${storageType}`);
      }

      // Registrar en historial
      await this.backupHistoryService.create({
        filename,
        path: finalPath,
        status: BackupStatus.SUCCESS,
        type,
        action: BackupAction.BACKUP,
        user_id: userId ?? undefined,
      });

      // Eliminar archivo temporal ya que ya no se necesita
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      return { success: true, filename, path: finalPath };
    } catch (error) {
      await this.backupHistoryService.create({
        filename,
        path: tempPath,
        status: BackupStatus.FAILED,
        type,
        action: BackupAction.BACKUP,
        user_id: userId ?? undefined,
        error: error.message,
      });
      throw new BadRequestException(`Error al crear backup: ${error.message}`);
    }
  }

  async getDatabaseInfo(): Promise<any> {
    try {
      const dbConfig = this.dataSource.options as any;
  
      // Información de las tablas con tamaño y cantidad de registros
      const tablesQuery = `
        SELECT 
          schemaname,
          relname as tablename,
          n_live_tup as row_estimate,
          pg_size_pretty(pg_total_relation_size(relid)) as size
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC;
      `;
      const tables = await this.dataSource.query(tablesQuery);
  
      // Tamaño total de la base de datos
      const sizeQuery = `
        SELECT pg_size_pretty(pg_database_size('${dbConfig.database}')) as database_size;
      `;
      const sizeResult = await this.dataSource.query(sizeQuery);
  
      // Versión de PostgreSQL
      const versionResult = await this.dataSource.query(`SELECT version();`);
  
  
      return {
        database: dbConfig.database,
        host: dbConfig.host,
        port: dbConfig.port,
        version: versionResult[0]?.version || 'N/A',
        size: sizeResult[0]?.database_size || 'N/A',
        tables: tables || []
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener información de la base de datos: ${error.message}`,
      );
    }
  }

  async getBackupFilePath(id: number): Promise<string> {
    const backup = await this.backupHistoryService.findOne(id);
    if (!backup) throw new NotFoundException(`Backup con id ${id} no encontrado`);
  
    const backupPath = backup.path;
    if (!fs.existsSync(backupPath)) {
      throw new NotFoundException(`Archivo de backup no encontrado en la ruta: ${backupPath}`);
    }
  
    return backupPath;
  }
}
