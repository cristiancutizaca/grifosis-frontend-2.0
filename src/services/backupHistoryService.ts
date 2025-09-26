import apiService from "./apiService";
import { BackupHistory } from "../../app/grifo-backup/types/backup-history";

class BackupHistoryService {
  private api = apiService;
  private endpoint = "/backups-histories";

  async getAllBackupsHistories(): Promise<BackupHistory[]> {
    return await this.api.get<BackupHistory[]>(`${this.endpoint}`);
  }

  async getBackupHistoryById(id: number): Promise<BackupHistory> {
    return await this.api.get<BackupHistory>(`${this.endpoint}/${id}`);
  }

  async getLastBackupHistory(): Promise<BackupHistory> {
    return await this.api.get<BackupHistory>(`${this.endpoint}/last`)
  }
}

const backupHistoryService = new BackupHistoryService();
export default backupHistoryService;
