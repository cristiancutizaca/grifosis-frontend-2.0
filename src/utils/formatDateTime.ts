// Format date and time for display (e.g., "20/06/2025 - 10:15 AM")
export const formatDateTime = (dateOrString: Date | string): string => {
    let date: Date;
    if (typeof dateOrString === 'string') {
        date = new Date(dateOrString);
    } else {
        date = dateOrString;
    }
    if (isNaN(date.getTime())) {
        return 'Fecha no válida';
    }
    const datePart = date.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const timePart = date.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
    return `${datePart} - ${timePart}`;
};