export interface BackupConfig {
    id: number;
    frequency: BackupFrequency;
    time_of_day: string;
    day_of_week?: number;
    day_of_month?: number;
    specific_day?: number;
    month?: string;
    storage_type: StorageType;
    is_active: boolean;
    is_default: boolean;
    created_at: string; 
}

export interface DataBaseInfo {
    database: string;
    host: string;
    port: number;
    version: string;
    size: string;
    tables: {
        schemaname: string;
        tablename: string;
        row_estimate: string;
        size: string;
    }[];
}