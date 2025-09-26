export enum NotificationType {
    SUCCESS = "success",
    ERROR = "error",
    INFO = "info",
    WARNING = "warning",
}

export interface Notification {
    id: number;
    message: string;
    type: NotificationType;
    details?: string;
}
