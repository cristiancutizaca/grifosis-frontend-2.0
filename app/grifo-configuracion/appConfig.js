// Configuración global de la aplicación - Solo Backend
export const APP_CONFIG = {
  // Modo de operación: solo 'online' (con backend)
  mode: 'online',
  
  // URL del backend
  backendUrl: 'http://localhost:8000/api',
  
  // Configuración de autenticación
  auth: {
    // Autenticación real requerida
    requireAuth: true,
    
    // Tiempo de expiración del token en minutos
    tokenExpirationMinutes: 60,
    
    // Redirección automática al login si no está autenticado
    autoRedirectToLogin: true
  },
  
  // Configuración de la aplicación
  app: {
    name: 'Grifosis',
    version: '1.0.0',
    description: 'Sistema de gestión para estaciones de servicio',
    
    // Configuración de paginación
    pagination: {
      defaultPageSize: 10,
      maxPageSize: 100
    },
    
    // Configuración de refresh automático
    autoRefresh: {
      enabled: true,
      intervalMinutes: 5
    }
  },
  
  // Configuración de endpoints
  endpoints: {
    auth: {
      login: '/auth/login',
      logout: '/auth/logout',
      refresh: '/auth/refresh',
      profile: '/auth/profile'
    },
    users: {
      base: '/users',
      permissions: '/users/:id/permissions',
      activate: '/users/:id/activate',
      deactivate: '/users/:id/deactivate'
    },
    employees: {
      base: '/employees'
    },
    clients: {
      base: '/clients'
    },
    sales: {
      base: '/sales'
    },
    products: {
      base: '/products'
    },
    reports: {
      base: '/reports'
    }
  },
  
  // Configuración de roles y permisos
  roles: {
    superadmin: {
      name: 'Super Admin',
      permissions: ['*'] // Todos los permisos
    },
    admin: {
      name: 'Administrador',
      permissions: [
        'users.read', 'users.create', 'users.update',
        'employees.read', 'employees.create', 'employees.update',
        'clients.read', 'clients.create', 'clients.update',
        'sales.read', 'sales.create', 'sales.update',
        'products.read', 'products.create', 'products.update',
        'reports.read'
      ]
    },
    seller: {
      name: 'Vendedor',
      permissions: [
        'clients.read', 'clients.update',
        'sales.read', 'sales.create',
        'products.read'
      ]
    }
  }
};

// Función para verificar si la aplicación está en modo online
export const isOnlineMode = () => APP_CONFIG.mode === 'online';

// Función para obtener la URL del backend
export const getBackendUrl = () => {
  return APP_CONFIG.backendUrl;
};

// Función para obtener la configuración de un endpoint
export const getEndpoint = (category, action = 'base') => {
  const endpoints = APP_CONFIG.endpoints[category];
  return endpoints ? endpoints[action] : null;
};

// Función para verificar permisos
export const hasPermission = (userRole, permission) => {
  const roleConfig = APP_CONFIG.roles[userRole];
  if (!roleConfig) return false;
  
  // Superadmin tiene todos los permisos
  if (roleConfig.permissions.includes('*')) return true;
  
  // Verificar permiso específico
  return roleConfig.permissions.includes(permission);
};

// Función para obtener el nombre del rol
export const getRoleName = (role) => {
  const roleConfig = APP_CONFIG.roles[role];
  return roleConfig ? roleConfig.name : role;
};

// Función para validar configuración
export const validateConfig = () => {
  const errors = [];
  
  if (!APP_CONFIG.backendUrl) {
    errors.push('Backend URL no configurada');
  }
  
  if (APP_CONFIG.mode !== 'online') {
    errors.push('Modo debe ser "online"');
  }
  
  if (!APP_CONFIG.auth.requireAuth) {
    errors.push('Autenticación debe estar habilitada');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Función para inicializar la configuración
export const initializeConfig = () => {
  const validation = validateConfig();
  
  if (!validation.isValid) {
    console.error('Errores de configuración:', validation.errors);
    throw new Error('Configuración inválida: ' + validation.errors.join(', '));
  }
  
  console.log('Configuración inicializada correctamente');
  console.log('Modo:', APP_CONFIG.mode);
  console.log('Backend URL:', APP_CONFIG.backendUrl);
  console.log('Autenticación requerida:', APP_CONFIG.auth.requireAuth);
};

// Función para obtener configuración de headers HTTP
export const getDefaultHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

// Función para obtener configuración de timeout
export const getRequestTimeout = () => {
  return 30000; // 30 segundos
};

// Función para verificar si el token está próximo a expirar
export const isTokenNearExpiration = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    const timeUntilExpiration = payload.exp - currentTime;
    
    // Considerar próximo a expirar si quedan menos de 5 minutos
    return timeUntilExpiration < 300;
  } catch {
    return true;
  }
};

// Función para formatear errores de API
export const formatApiError = (error) => {
  if (error.message.includes('403')) {
    return 'No tiene permisos para realizar esta acción';
  }
  
  if (error.message.includes('401')) {
    return 'Su sesión ha expirado. Por favor, inicie sesión nuevamente';
  }
  
  if (error.message.includes('404')) {
    return 'El recurso solicitado no fue encontrado';
  }
  
  if (error.message.includes('500')) {
    return 'Error interno del servidor. Contacte al administrador';
  }
  
  if (error.message.includes('fetch')) {
    return 'Error de conexión. Verifique su conexión a internet y que el servidor esté funcionando';
  }
  
  return error.message || 'Error desconocido';
};

