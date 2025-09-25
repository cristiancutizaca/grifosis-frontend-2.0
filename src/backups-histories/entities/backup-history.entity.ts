import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BackupStatus, BackupType, BackupAction } from '../constants/backup-history.contants';

@Entity('backup_history')
export class BackupHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  filename: string;

  @Column({ type: 'text' })
  path: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'varchar', length: 50, enum: BackupStatus })
  status: BackupStatus;

  @Column({ type: 'varchar', length: 50, enum: BackupType })
  type: BackupType;

  @Column({ type: 'varchar', length: 50, enum: BackupAction })
  action: BackupAction;

  @Column({ nullable: true })
  user_id?: number | null;

  @Column({ type: 'text', nullable: true })
  error: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
