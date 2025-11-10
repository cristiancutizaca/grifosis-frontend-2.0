// Configuración global de la aplicación
export const APP_CONFIG = {
  // Modo de operación: 'online' (con backend) o 'offline' (sin backend)
  mode: 'online', // Cambiar a 'online' para habilitar el backend
  
  // URL del backend (solo se usa en modo 'online')
  backendUrl: 'http://localhost:8000/api',
  
  // Configuración de autenticación
  auth: {
    // En modo offline, se puede omitir la autenticación real
    requireAuth: false, // Cambiar a true para requerir autenticación real
    
    // Usuario por defecto para modo offline
    defaultUser: {
      username: 'demo',
      role: 'admin', // Puede ser 'superadmin', 'admin', o 'seller'
      token: 'demo-token-offline-mode'
    }
  },
  
  // Datos de demostración para modo offline
  demoData: {
    clientes: [
      { id: 1, nombre: 'Cliente Demo 1', telefono: '123-456-7890', credito: 500, email: 'cliente1@demo.com' },
      { id: 2, nombre: 'Cliente Demo 2', telefono: '098-765-4321', credito: 750, email: 'cliente2@demo.com' },
      { id: 3, nombre: 'Cliente Demo 3', telefono: '555-123-4567', credito: 300, email: 'cliente3@demo.com' },
    ],
    ventas: [
      { id: 1, cliente: 'Cliente Demo 1', producto: 'Gasolina Regular', cantidad: 20, total: 400, fecha: '2024-01-15' },
      { id: 2, cliente: 'Cliente Demo 2', producto: 'Diesel', cantidad: 15, total: 300, fecha: '2024-01-15' },
      { id: 3, cliente: 'Cliente Demo 3', producto: 'Gasolina Premium', cantidad: 10, total: 220, fecha: '2024-01-14' },
    ],
    inventario: [
      { id: 1, producto: 'Gasolina Regular', stock: 1000, precio: 20, categoria: 'Combustible' },
      { id: 2, producto: 'Gasolina Premium', stock: 800, precio: 22, categoria: 'Combustible' },
      { id: 3, producto: 'Diesel', stock: 600, precio: 18, categoria: 'Combustible' },
      { id: 4, producto: 'Aceite Motor', stock: 50, precio: 25, categoria: 'Lubricantes' },
    ],
    empleados: [
      { id: 1, nombre: 'Juan Pérez', puesto: 'Vendedor', turno: 'Mañana', telefono: '555-0001', email: 'juan@demo.com' },
      { id: 2, nombre: 'María García', puesto: 'Supervisor', turno: 'Tarde', telefono: '555-0002', email: 'maria@demo.com' },
      { id: 3, nombre: 'Carlos López', puesto: 'Vendedor', turno: 'Noche', telefono: '555-0003', email: 'carlos@demo.com' },
    ],
    creditos: [
      { id: 1, cliente: 'Cliente Demo 1', monto: 500, fechaVencimiento: '2024-02-15', estado: 'Activo' },
      { id: 2, cliente: 'Cliente Demo 2', monto: 750, fechaVencimiento: '2024-02-20', estado: 'Activo' },
      { id: 3, cliente: 'Cliente Demo 3', monto: 300, fechaVencimiento: '2024-01-30', estado: 'Vencido' },
    ],
    turnos: [
      { id: 1, empleado: 'Juan Pérez', turno: 'Mañana', fecha: '2024-01-15', horaInicio: '06:00', horaFin: '14:00' },
      { id: 2, empleado: 'María García', turno: 'Tarde', fecha: '2024-01-15', horaInicio: '14:00', horaFin: '22:00' },
      { id: 3, empleado: 'Carlos López', turno: 'Noche', fecha: '2024-01-15', horaInicio: '22:00', horaFin: '06:00' },
    ],
    configuracion: {
      nombreEmpresa: 'Gas Station Demo',
      direccion: '123 Calle Principal, Ciudad Demo',
      telefono: '555-0123',
      email: 'demo@gasstation.com',
      moneda: 'USD',
      impuesto: 0.16,
      horarioApertura: '06:00',
      horarioCierre: '22:00'
    }
  }
};

// Función para verificar si la aplicación está en modo online
export const isOnlineMode = () => APP_CONFIG.mode === 'online';

// Función para verificar si la aplicación está en modo offline
export const isOfflineMode = () => APP_CONFIG.mode === 'offline';

// Función para cambiar el modo de la aplicación
export const setAppMode = (mode) => {
  APP_CONFIG.mode = mode;
  // Guardar en sessionStorage para persistir durante la sesión
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('app_mode', mode);
    window.location.reload();
  }
};

// Función para obtener la URL del backend
export const getBackendUrl = () => {
  return isOnlineMode() ? APP_CONFIG.backendUrl : null;
};

// Función para obtener datos demo
export const getDemoData = (type) => {
  return APP_CONFIG.demoData[type] || [];
};

// Función para inicializar el modo desde sessionStorage
export const initializeAppMode = () => {
  if (typeof window !== 'undefined') {
    const storedMode = sessionStorage.getItem('app_mode');
    if (storedMode && (storedMode === 'online' || storedMode === 'offline')) {
      APP_CONFIG.mode = storedMode;
    }
  }
};

