import apiService from "./apiService";
import { BackupConfig } from '../../app/grifo-backup/types/backup-config';

class BackupConfigService {
  private endpoint = "/backup-config";
  private api = apiService;

  async createConfig(data: Partial<BackupConfig>): Promise<BackupConfig> {
    return this.api.post<BackupConfig>(this.endpoint, data);
  }

  async getDefaultConfig(): Promise<BackupConfig> {
    return this.api.get<BackupConfig>(`${this.endpoint}/default`);
  }

  async updateConfig(id: number, data: Partial<BackupConfig>): Promise<BackupConfig> {
    return this.api.put<BackupConfig>(`${this.endpoint}/${id}`, data);
  }
}

const backupConfigService = new BackupConfigService();
export default backupConfigService;