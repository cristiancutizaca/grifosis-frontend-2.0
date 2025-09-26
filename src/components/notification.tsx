import React from "react";
import { Notification, NotificationType } from "src/types/notification";

interface NotificationProps {
  notifications: Notification[];
  onRemove: (id: number) => void;
}

const NotificationList: React.FC<NotificationProps> = ({ notifications, onRemove }) => {
  const getNotificationStyles = (type: NotificationType) => {
    switch (type) {
      case NotificationType.SUCCESS:
        return {
          bg: "bg-green-500/20",
          border: "border-2 border-green-500",
          text: "text-green-100"
        };
      case NotificationType.ERROR:
        return {
          bg: "bg-red-500/20",
          border: "border-2 border-red-500",
          text: "text-red-100"
        };
      case NotificationType.INFO:
        return {
          bg: "bg-blue-500/20",
          border: "border-2 border-blue-500",
          text: "text-blue-100"
        };
      case NotificationType.WARNING:
        return {
          bg: "bg-yellow-500/20",
          border: "border-2 border-yellow-500",
          text: "text-yellow-100"
        };
      default:
        return {
          bg: "bg-gray-500/20",
          border: "border-2 border-gray-500",
          text: "text-gray-100"
        };
    }
  };

  return (
    <div className="fixed inset-0 flex justify-center items-center z-50 pointer-events-none">
      <div className="space-y-4">
        {notifications.map((n) => {
          const styles = getNotificationStyles(n.type);
          
          return (
            <div
              key={n.id}
              className={`
                p-6 rounded-2xl shadow-2xl transition-all duration-300 pointer-events-auto 
                min-w-[300px] text-center backdrop-blur-sm
                ${styles.bg} ${styles.border} ${styles.text}
                hover:scale-[1.02] hover:shadow-3xl
              `}
            >
              <div className="flex justify-between items-start text-left">
                <div className="flex-1">
                  <span className="block font-medium text-lg leading-relaxed">
                    {n.message}
                  </span>

                  {n.details && (
                    <span className="block font-medium text-lg leading-relaxed">
                      • {n.details}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onRemove(n.id)}
                  className={`
                    ml-4 p-2 rounded-lg transition-all duration-200
                    ${styles.text} hover:bg-white/10 hover:scale-110
                    flex items-center justify-center w-8 h-8
                  `}
                  title="Cerrar notificación"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationList;
