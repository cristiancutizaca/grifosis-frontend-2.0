import { BackupStatus } from '../constants/backup.constants'

export interface BackupHistoryUser {
    user_id: number;
    username: string;
    full_name: string | null;
    role: string;
}

export interface BackupHistory {
    id: number;
    filename: string;
    path: string;
    created_at: string;
    status: BackupStatus;
    type: string;
    action: string;
    user: BackupHistoryUser;
}