import { DataBaseInfo } from '../../app/grifo-backup/types/backup-config';
import apiService from './apiService';
import { BackupType } from 'app/grifo-backup/constants/backup.constants';

class BackupService {
    private endpoint = '/backup';
    private api = apiService;

    async createBackup(type: BackupType = BackupType.MANUAL) {
        return await this.api.post(`${this.endpoint}/backup`, { type });
    }

    async getDatabaseInfo(): Promise<DataBaseInfo> {
        return await this.api.get<DataBaseInfo>(`${this.endpoint}/database-info`);
    }

    async downloadBackup(id: number, filename: string) {
        const url = `${this.api.getBaseURL()}${this.endpoint}/download/${id}`;
        const token = sessionStorage.getItem('token');
    
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                ...(token && { 'Authorization': `Bearer ${token}` }),
            },
        });
    
        if (!res.ok) throw new Error(`Error al descargar backup: ${res.statusText}`);
    
        const blob = await res.blob();
    
        const contentDisposition = res.headers.get('content-disposition');
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?(.+)"?/);
            if (match?.[1]) filename = decodeURIComponent(match[1]).replace(/["']/g, '');
        }        
    
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
    }    
}

const backupService = new BackupService();
export default backupService;
