import { useEffect, useState } from 'react';
import { BackupConfig, DataBaseInfo } from '../types/backup-config';
import { BackupHistory } from '../types/backup-history';
import BackupHistoryService from '../../../src/services/backupHistoryService';
import BackupService from '../../../src/services/backupService';
import { BackupFrequency, BackupType } from '../constants/backup.constants';
import BackupConfigService from '../../../src/services/backupConfigService';
import { useNotification } from '../../../src/hooks/use-notification';
import { NotificationType } from "../../../src/types/notification";
import { BackupMessages } from "../constants/messages"

export function useBackup() {
    const { notifications, addNotification, removeNotification } = useNotification();

    const [backupconfig, setBackupConfig] = useState<BackupConfig | null>(null);

    const [historialBackup, setBackupHistory] = useState<BackupHistory[]>([]);

    const [informacionBaseDatos, setInformacionBaseDatos] = useState<DataBaseInfo | null>(null);

    const [error, setError] = useState<string | null>(null);

    const [loading, setLoading] = useState<boolean>(false);

    const [creatingBackup, setCreatingBackup] = useState<boolean>(false);

    // Crear un backup
    const createBackup = async (type: BackupType = BackupType.MANUAL) => {
        try {
            setCreatingBackup(true);
            const response = await BackupService.createBackup(type);

            await loadBackupHistory();
            setError(null);
            addNotification(BackupMessages.CREATED, NotificationType.SUCCESS);
            return response;
        } catch (err: any) {
            addNotification(err.message || BackupMessages.CREATE_ERROR, NotificationType.ERROR);
        } finally {
            setCreatingBackup(false);
        }
    };

    // Crear nueva configuración (se guarda en BD y se setea en estado)
    const createBackupConfig = async (configData: Partial<BackupConfig>) => {
        try {
            const newConfig = await BackupConfigService.createConfig(configData);
            setBackupConfig(newConfig);
            addNotification(BackupMessages.CREATED_CONFIG, NotificationType.SUCCESS);
            return newConfig;
        } catch (err: any) {
            addNotification(err.message || BackupMessages.ERROR_SAVE_CONFIG, NotificationType.ERROR);
        }
    };

    // Actualizar configuración de backup
    const updateBackupConfig = async (id: number, updatedConfig: Partial<BackupConfig>) => {
        try {
            const updated = await BackupConfigService.updateConfig(id, updatedConfig);
            setBackupConfig(updated);
            setError(null);
            addNotification(BackupMessages.UPDATED_CONFIG, NotificationType.INFO);
            return updated;
        } catch (err: any) {
            addNotification(err.message || BackupMessages.ERROR_SAVE_CONFIG, NotificationType.ERROR);
        }
    };

    // Cargar historial de backups desde el backend
    const loadBackupHistory = async () => {
        try {
            setLoading(true);
            const backups = await BackupHistoryService.getAllBackupsHistories();
            setBackupHistory(backups);
            setError(null);
        } catch (err: any) {
            addNotification(err.message || BackupMessages.ERROR_LOAD_HISTORY, NotificationType.ERROR);
        } finally {
            setLoading(false);
        }
    };

    // Cargar información de la base de datos desde el backend
    const loadDataBaseInfo = async () => {
        try {
            setLoading(true);
            const databaseInfo = await BackupService.getDatabaseInfo();
            setInformacionBaseDatos(databaseInfo);
            setError(null);
        } catch (err: any) {
            addNotification(err.message || BackupMessages.ERROR_LOAD_DATABASE_INFO, NotificationType.ERROR);
        }
    };

    // Cargar configuración por defecto del backend
    const loadBackupConfig = async () => {
        try {
            setLoading(true);
            const config = await BackupConfigService.getDefaultConfig();
            setBackupConfig(config);
            setError(null);
        } catch (err: any) {
            addNotification(err.message || BackupMessages.ERROR_LOAD_CONFIG, NotificationType.ERROR)
        } finally {
            setLoading(false);
        }
    };

    // Cargar información al montar el hook
    useEffect(() => {
        loadBackupHistory();
        loadDataBaseInfo();
        loadBackupConfig();
    }, []);

    // Descargar backup por id y nombre de archivo
    const downloadBackupById = async (id: number, filename: string) => {
        try {
            await BackupService.downloadBackup(id, filename);
        } catch (err: any) {
            console.error(err);
            setError('Error al descargar el backup');
        }
    };

    const handleCreateBackup = async () => {
        try {
            await createBackup();
        } catch (err) {
            alert('Error al crear el backup ❌');
        }
    };

    // Calcular el próximo backup según la frecuencia
    const calcularProximoBackup = (): string => {
        if (!backupconfig) {
            return 'Sin configuración de backup';
        }

        const ahora = new Date();
        
        if (!backupconfig.time_of_day) {
            return 'Hora de backup no configurada';
        }
        
        // Tomar la hora desde time_of_day ("HH:mm:ss")
        const [horas, minutos] = backupconfig.time_of_day.split(':').map(Number);

        let proximaFecha = new Date(ahora);
        proximaFecha.setHours(horas, minutos || 0, 0, 0);

        // Si la hora ya pasó hoy, programar para mañana
        if (proximaFecha <= ahora) {
            proximaFecha.setDate(proximaFecha.getDate() + 1);
        }

        const frecuencia = backupconfig.frequency;
        
        switch (frecuencia) {
            case BackupFrequency.DAILY:
                break;
                
            case BackupFrequency.WEEKLY:
                if (backupconfig.day_of_week !== undefined) {
                    const diaActual = proximaFecha.getDay();
                    let diasParaSumar = backupconfig.day_of_week - diaActual;
    
                    // Si el día ya pasó esta semana, ir a la próxima
                    if (diasParaSumar <= 0) {
                        diasParaSumar += 7;
                    }
                    proximaFecha.setDate(proximaFecha.getDate() + diasParaSumar);
                }
                break;
                
            case BackupFrequency.MONTHLY:
                if (backupconfig.day_of_month !== undefined) {
                    const diaActual = proximaFecha.getDate();
                    const diaObjetivo = backupconfig.day_of_month;
    
                    // Si el día ya pasó este mes, programar para el próximo mes
                    if (diaObjetivo <= diaActual) {
                        proximaFecha.setMonth(proximaFecha.getMonth() + 1);
                    }
                    proximaFecha.setDate(diaObjetivo);
                }
                break;
                
            case BackupFrequency.YEARLY:
                if (
                    backupconfig.specific_day !== undefined &&
                    backupconfig.month && typeof backupconfig.month === "string"
                ) {
                    const meses: { [key: string]: number } = {
                        "JANUARY": 0, "FEBRUARY": 1, "MARCH": 2, "APRIL": 3,
                        "MAY": 4, "JUNE": 5, "JULY": 6, "AUGUST": 7,
                        "SEPTEMBER": 8, "OCTOBER": 9, "NOVEMBER": 10, "DECEMBER": 11
                    };
            
                    const mesClave = backupconfig.month.toUpperCase();
                    const mesObjetivo = meses[mesClave];
            
                    if (mesObjetivo !== undefined) {
                        const diaObjetivo = backupconfig.specific_day;
            
                        proximaFecha.setMonth(mesObjetivo, diaObjetivo);
            
                        if (proximaFecha <= ahora) {
                            proximaFecha.setFullYear(proximaFecha.getFullYear() + 1);
                            proximaFecha.setMonth(mesObjetivo, diaObjetivo);
                        }
                    } else {
                        return "Mes inválido en configuración de backup";
                    }
                }
                break;
                
            case 'Desactivado':
                return 'Backup desactivado';
                
            default:
                break;
        }

        return proximaFecha.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }) + ' - ' + proximaFecha.toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return {
        backupconfig,
        createBackupConfig,
        updateBackupConfig,
        calcularProximoBackup,
        
        historialBackup,
        loadBackupHistory,
        createBackup,
        loading,
        creatingBackup,
        error,
        handleCreateBackup,
        downloadBackupById,

        informacionBaseDatos,

        // notificaciones
        notifications,
        removeNotification,    
    }
}
