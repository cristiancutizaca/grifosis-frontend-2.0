import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { StorageType } from '../constants/backup.constants';

@Entity('backup_config')
export class BackupConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  frequency: string;

  @Column({ type: 'time' })
  time_of_day: string;

  @Column({ type: 'int', nullable: true })
  day_of_week?: number;

  @Column({ type: 'int', nullable: true })
  day_of_month?: number;

  @Column({ type: 'int', nullable: true })
  specific_day?: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  month?: string;

  @Column({ type: 'enum', enum: StorageType })
  storage_type: StorageType;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
