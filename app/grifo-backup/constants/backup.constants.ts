export enum BackupStatus {
  SUCCESS = "✅ Exitoso",
  FAILED = "❌ Fallido",
} 

export enum BackupType {
  MANUAL = 'Manual',
  AUTO = 'Automático',
} 

export enum BackupAction {
  BACKUP = 'Backup',
  RESTORE = 'Restore',
} 

export enum BackupFrequency {
  DAILY = "Diario",
  WEEKLY = "Semanal",
  MONTHLY = "Mensual",
  YEARLY = "Anual",
  DISABLED = "Desactivado",
}

export enum StorageType {
  LOCAL = 'local',
  S3 = 's3',
  GDRIVE = 'gdrive',
}
