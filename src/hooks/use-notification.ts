import { useState, useCallback } from "react";
import { Notification, NotificationType } from "../types/notification";

export function useNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (message: string, type: NotificationType, details?: string) => {
      const newNotification: Notification = {
        id: Date.now(),
        message,
        type,
        details,
      };

      setNotifications((prev) => [...prev, newNotification]);

      // Auto-remover después de n segundos
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, 3000);
    },
    [removeNotification]
  );

  return {
    notifications,
    addNotification,
    removeNotification,
  };
}
