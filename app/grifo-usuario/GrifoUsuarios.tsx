'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { jwtDecode } from 'jwt-decode'
import EditUserModal from './modal/EditUserModal'
import AddUserModal from './modal/AddUserModal'
import userService, { User as ApiUser } from '../../src/services/userService'
import { APP_CONFIG, isOnlineMode, isOfflineMode } from '../../src/config/appConfig'

// Define la interfaz para la información del usuario obtenida del token
// Esto permite a TypeScript saber la estructura esperada de 'currentUser'
interface CurrentUserTokenInfo {
  user_id: number;
  username: string;
  role: string;
  // Si esperas otras propiedades del token decodificado, agrégalas aquí.
  // Por ejemplo: id?: number; email?: string;
}

export function getCurrentUser(): CurrentUserTokenInfo | null {
  if (typeof window === "undefined") {
    return null;
  }
  const token = sessionStorage.getItem('token');
  if (!token) return null;

  const decoded = jwtDecode<CurrentUserTokenInfo & { sub?: number }>(token);
  const userId = decoded.sub;

  if (!userId) {
    throw new Error('Token inválido'); // falta user_id o sub
  }
  return {
    user_id: userId,
    username: decoded.username,
    role: decoded.role
  };
}

const GrifoUsuarios: React.FC = () => {
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Estados para modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Estados para datos de la API
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ***************************************************************
  // CAMBIO CLAVE AQUÍ: Define el tipo de currentUser como CurrentUserTokenInfo o null
  const [currentUser, setCurrentUser] = useState<CurrentUserTokenInfo | null>(null);
  // ***************************************************************

  const [appMode, setAppMode] = useState<string>('offline');

  // NUEVO: router + helper de rol (todo en el mismo archivo)
  const router = useRouter();
  const isAdminRole = (r?: string | null) => r === 'admin' || r === 'superadmin' || r === 'super_admin';

  // Obtener información del usuario actual desde el token
  useEffect(() => {
    const getCurrentUserInfo = () => {
      try {
        const token = typeof window !== "undefined" ? sessionStorage.getItem('token') : null;
        const storedMode = typeof window !== "undefined" ? sessionStorage.getItem('app_mode') : 'offline';

        setAppMode(storedMode || 'offline');

        if (!token) {
          setError('No hay token de autenticación. Inicie sesión primero.');
          setLoading(false);
          // si no hay token, redirige fuera también
          try { router.replace('/403'); } catch {}
          return;
        }

        // Declara userInfo con el tipo correcto (puede ser el objeto o null inicialmente)
        let userInfo: CurrentUserTokenInfo | null = null;

        if (isOfflineMode() || storedMode === 'offline') {
          // En modo offline, usar datos del token simulado
          try {
            const decodedOfflineToken = JSON.parse(atob(token));
            // Asegúrate de que las propiedades existan antes de asignarlas
            if (decodedOfflineToken.username && decodedOfflineToken.role) {
              userInfo = {
                user_id: decodedOfflineToken.sub ?? 0,
                username: decodedOfflineToken.username,
                role: decodedOfflineToken.role
              };
            } else {
              // Si el token simulado no tiene la estructura esperada
              userInfo = {
                user_id: 0,
                username: APP_CONFIG.auth.defaultUser.username,
                role: APP_CONFIG.auth.defaultUser.role
              };
            }
          } catch {
            // Si el token simulado es inválido o no existe
            userInfo = {
              user_id: 0,
              username: APP_CONFIG.auth.defaultUser.username,
              role: APP_CONFIG.auth.defaultUser.role
            };
          }
        } else {
          // En modo online, decodificar el JWT real
          try {
            const decoded: any = jwtDecode(token); // jwtDecode puede retornar 'any' o un tipo genérico
            // Mapea las propiedades decodificadas a tu interfaz CurrentUserTokenInfo
            userInfo = {
              user_id: Number(decoded.sub) ?? 0,
              username: decoded.username || decoded.sub || 'Usuario',
              role: decoded.role || decoded.rol || 'seller'
            };
          } catch (error) {
            console.error('Error al decodificar token:', error);
            setError('Token inválido. Inicie sesión nuevamente.');
            setLoading(false);
            try { router.replace('/403'); } catch {}
            return;
          }
        }

        setCurrentUser(userInfo); // Ahora esto es una asignación de tipo válida

        // 🔒 BLOQUEO TOTAL: si no es admin/superadmin, fuera inmediatamente
        if (!isAdminRole(userInfo?.role)) {
          try {
            sessionStorage.removeItem('token');
            localStorage.removeItem('authToken');
          } catch {}
          setLoading(false);
          try { router.replace('/403'); } catch {}
          return; // corta aquí para NO seguir cargando nada de la vista
        }

        // Sincronizar token entre sessionStorage y localStorage
        if (typeof window !== "undefined" && token) {
          localStorage.setItem('authToken', token);
        }

        // Solo cargar usuarios si está en modo online
        if (isOnlineMode() && storedMode === 'online') {
          loadUsers();
        } else {
          // En modo offline, usar datos de demostración
          setUsers([
            {
              user_id: 1,
              employee_id: 1,
              username: 'admin_demo',
              role: 'admin',
              is_active: true,
              created_at: '2023-01-15T08:00:00Z',
              updated_at: '2023-06-10T10:00:00Z',
              full_name: 'Administrador Demo'
            },
            {
              user_id: 2,
              employee_id: 2,
              username: 'vendedor_demo',
              role: 'seller',
              is_active: true,
              created_at: '2023-02-20T09:30:00Z',
              updated_at: '2023-05-05T14:45:00Z',
              full_name: 'Vendedor Demo'
            }
          ]);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error al obtener información del usuario:', error);
        setError('Error al obtener información del usuario');
        setLoading(false);
        try { router.replace('/403'); } catch {}
      }
    };

    getCurrentUserInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar usuarios desde la API (solo en modo online)
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Verificar que tenemos token
      const token = typeof window !== "undefined" ? sessionStorage.getItem('token') : null;
      if (!token) {
        setError('No hay token de autenticación disponible');
        setLoading(false);
        try { router.replace('/403'); } catch {}
        return;
      }

      // Guardar el token en localStorage para que el apiService lo use
      if (typeof window !== "undefined") {
        localStorage.setItem('authToken', token);
      }

      const usersData = await userService.getAll();
      setUsers(usersData);
    } catch (err: any) {
      console.error('Error al cargar usuarios:', err);

      // Manejo específico de errores
      if (err.message?.includes?.('permisos') || err.message?.includes?.('403')) {
        setError(`Error 403: No tiene permisos para ver los usuarios. Su rol actual es: ${currentUser?.role || 'desconocido'}`);
      } else if (err.message?.includes?.('401')) {
        setError('Error 401: Token expirado o inválido. Inicie sesión nuevamente.');
      } else if (
        err.message?.includes?.('conexión') ||
        err.message?.includes?.('fetch') ||
        err.message?.includes?.('NetworkError')
      ) {
        setError('Error de conexión: No se puede conectar al servidor. Verifique que el backend esté funcionando en el puerto 8000.');
      } else if (err.message?.includes?.('404')) {
        setError('Error 404: El endpoint de usuarios no fue encontrado en el backend.');
      } else {
        setError('Error al cargar los usuarios: ' + err.message);
      }

      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Función para manejar cuando se crea un nuevo usuario
  const handleUserCreated = () => {
    // Recargar la lista de usuarios
    if (isOnlineMode() && appMode === 'online') {
      loadUsers();
    }
  };

  // Función para mapear roles del backend a nombres en español
  const mapRole = (role: string): string => {
    const roleMap: { [key: string]: string } = {
      'superadmin': 'Super Admin',
      'admin': 'Administrador',
      'seller': 'Vendedor'
    };
    return roleMap[role] || role;
  };

  // Verificar si el usuario actual tiene permisos para una acción
  const hasPermission = (action: string): boolean => {
    if (!currentUser) return false;

    // Superadmin puede hacer todo
    if (currentUser.role === 'superadmin') return true;

    // Admin puede hacer la mayoría de cosas excepto eliminar
    if (currentUser.role === 'admin') {
      return action !== 'delete';
    }

    // Seller solo puede ver (aunque ya está bloqueado antes de renderizar)
    return action === 'read';
  };

  // Filtrar usuarios
  const filteredUsers = users.filter(user => {
    const displayName = user.full_name || user.username;
    const matchesSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayName.toLowerCase().includes(searchTerm.toLowerCase());

    const mappedRole = mapRole(user.role);
    const matchesRole = roleFilter === '' || mappedRole === roleFilter;
    const userStatus = user.is_active ? 'Activo' : 'Inactivo';
    const matchesStatus = statusFilter === '' || userStatus === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);

  const handleEditUser = (user: ApiUser) => {
    if (!hasPermission('update')) {
      setError('No tiene permisos para editar usuarios');
      return;
    }
    setEditingUser(user);
  };

  const handleUpdateUser = async (updatedUser: ApiUser) => {
    if (appMode === 'offline') {
      // En modo offline, simular actualización
      setUsers(users.map(u =>
        u.user_id === updatedUser.user_id ? updatedUser : u
      ));
      setError(null);
      return;
    }

    try {
      const updated = await userService.update(updatedUser.user_id, {
        username: updatedUser.username,
        role: updatedUser.role,
        is_active: updatedUser.is_active,
        full_name: updatedUser.full_name,
        employee_id: updatedUser.employee_id
      });
      setUsers(users.map(u =>
        u.user_id === updated.user_id ? updated : u
      ));
      setError(null);
    } catch (err: any) {
      console.error('Error al actualizar usuario:', err);
      if (err.message?.includes?.('permisos') || err.message?.includes?.('403')) {
        setError('No tiene permisos para actualizar usuarios');
      } else {
        setError('Error al actualizar el usuario: ' + err.message);
      }
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!hasPermission('delete')) {
      setError('No tiene permisos para eliminar usuarios');
      return;
    }

    if (window.confirm('¿Está seguro de que desea eliminar este usuario?')) {
      if (appMode === 'offline') {
        // En modo offline, simular eliminación
        setUsers(users.filter(u => u.user_id !== userId));
        setError(null);
        return;
      }

      try {
        await userService.delete(userId);
        setUsers(users.filter(u => u.user_id !== userId));
        setError(null);
      } catch (err: any) {
        console.error('Error al eliminar usuario:', err);
        if (err.message?.includes?.('permisos') || err.message?.includes?.('403')) {
          setError('No tiene permisos para eliminar usuarios');
        } else {
          setError('Error al eliminar el usuario: ' + err.message);
        }
      }
    }
  };

  const handleToggleStatus = async (user: ApiUser) => {
    if (!hasPermission('update')) {
      setError('No tiene permisos para cambiar el estado de usuarios');
      return;
    }

    if (appMode === 'offline') {
      // En modo offline, simular cambio de estado
      const updatedUser = { ...user, is_active: !user.is_active };
      setUsers(users.map(u =>
        u.user_id === updatedUser.user_id ? updatedUser : u
      ));
      setError(null);
      return;
    }

    try {
      const updated = user.is_active
        ? await userService.deactivate(user.user_id)
        : await userService.activate(user.user_id);
      setUsers(users.map(u =>
        u.user_id === updated.user_id ? updated : u
      ));
      setError(null);
    } catch (err: any) {
      console.error('Error al cambiar estado del usuario:', err);
      if (err.message?.includes?.('permisos') || err.message?.includes?.('403')) {
        setError('No tiene permisos para cambiar el estado de usuarios');
      } else {
        setError('Error al cambiar el estado del usuario: ' + err.message);
      }
    }
  };

  const handleRetry = () => {
    if (appMode === 'online') {
      loadUsers();
    }
  };

  // Componente para el icono de búsqueda
  const SearchIcon = () => (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
    </svg>
  );

  // Componente para el icono de lápiz (editar)
  const EditIcon = () => (
    <svg className="w-5 h-5 text-blue-400 hover:text-blue-300 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z"></path>
    </svg>
  );

  // Componente para el icono de papelera (eliminar)
  const DeleteIcon = () => (
    <svg className="w-5 h-5 text-red-400 hover:text-red-300 cursor-pointer ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
    </svg>
  );

  // Iconos adicionales
  const UsersIcon = () => (
    <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
    </svg>
  );

  const FilterIcon = () => (
    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"></path>
    </svg>
  );

  const RefreshIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
    </svg>
  );

  // Doble seguro por si la redirección tarda un frame
  if (currentUser && !isAdminRole(currentUser.role)) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6 bg-slate-900 min-h-screen">
        <div className="bg-slate-800 rounded-2xl p-4 lg:p-6 border border-slate-700">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            <span className="ml-3 text-slate-400">Cargando usuarios...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-slate-900 min-h-screen space-y-4 lg:space-y-6">
      {/* Información del usuario actual y modo */}
      {currentUser && (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex justify-between items-center">
          <div className="text-sm text-slate-300">
            Usuario: <span className="text-white font-medium">{currentUser.username}</span>
            <span className="ml-2 text-orange-400">({mapRole(currentUser.role)})</span>
            <span className="ml-2 text-xs text-slate-400">
              Modo: {appMode === 'online' ? '🟢 Online' : '🔴 Offline (Demo)'}
            </span>
          </div>
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="text-red-300 text-sm">{error}</span>
            </div>
            <div className="flex items-center gap-2">
              {appMode === 'online' && (
                <button
                  onClick={handleRetry}
                  className="text-red-400 hover:text-red-300 p-1"
                  title="Reintentar"
                >
                  <RefreshIcon />
                </button>
              )}
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usuarios */}
      <div>
        {/* Header */}
        <div className="bg-slate-800 rounded-2xl p-4 lg:p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <UsersIcon />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white">Gestión de Usuarios</h1>
              <p className="text-sm text-slate-400">
                Administra los usuarios del sistema
                {appMode === 'offline' && <span className="text-yellow-400"> (Modo Demo)</span>}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* Botón Agregar Usuario */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-medium transition-all transform hover:scale-105 flex items-center gap-2"
                title="Agregar nuevo usuario"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Agregar Usuario</span>
              </button>

              {appMode === 'online' && (
                <button
                  onClick={handleRetry}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                  title="Actualizar datos"
                >
                  <RefreshIcon />
                </button>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <div className="text-2xl font-bold text-white">{users.length}</div>
              <div className="text-sm text-slate-400">Total Usuarios</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <div className="text-2xl font-bold text-green-400">{users.filter(u => u.is_active).length}</div>
              <div className="text-sm text-slate-400">Activos</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <div className="text-2xl font-bold text-red-400">{users.filter(u => !u.is_active).length}</div>
              <div className="text-sm text-slate-400">Inactivos</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <div className="text-2xl font-bold text-blue-400">{users.filter(u => u.role === 'admin').length}</div>
              <div className="text-sm text-slate-400">Administradores</div>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="bg-slate-800 rounded-2xl p-4 lg:p-6 border border-slate-700">
          {/* Controles superiores */}
          <div className="flex flex-col lg:flex-row items-center gap-3 mb-6">
            {/* Barra de búsqueda */}
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Buscar usuario por nombre o username"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white placeholder-slate-400"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <SearchIcon />
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full sm:w-auto pl-10 pr-8 py-3 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 text-white appearance-none cursor-pointer min-w[160px]"
                >
                  <option value="">Todos los Roles</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Vendedor">Vendedor</option>
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <FilterIcon />
                </div>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto pl-10 pr-8 py-3 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 text-white appearance-none cursor-pointer min-w[160px]"
                >
                  <option value="">Todos los Estados</option>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
                  </svg>
                </div>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de usuarios */}
          {users.length > 0 ? (
            <div className={`${filteredUsers.length > 6 ? 'max-h-[500px] overflow-y-auto' : ''} overflow-x-auto rounded-lg border border-slate-600`}>
              <table className="min-w-full divide-y divide-slate-600">
                <thead className="bg-slate-700/50">
                  <tr className="sticky top-0 z-10 bg-slate-700/50 backdrop-blur">
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">ID Empleado</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Rol</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {filteredUsers.map((user) => (
                    <tr key={user.user_id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {(user.full_name || user.username).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">
                              {user.full_name || user.username}
                            </div>
                            <div className="text-sm text-slate-400">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-white">
                          {user.employee_id || 'Sin asignar'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                          user.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : user.role === 'superadmin'
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                          {mapRole(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={!hasPermission('update')}
                          className={`inline-flex px-3 py-1 text-xs font-medium rounded-full transition-colors ${hasPermission('update') ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                            } ${user.is_active
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                            }`}
                          title={hasPermission('update') ? `Click para ${user.is_active ? 'desactivar' : 'activar'}` : 'Sin permisos'}
                        >
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleEditUser(user)}
                            disabled={!hasPermission('update')}
                            className={`p-2 rounded-lg transition-colors ${hasPermission('update')
                              ? 'bg-blue-500/20 hover:bg-blue-500/30 cursor-pointer'
                              : 'bg-gray-500/20 cursor-not-allowed opacity-50'
                              }`}
                            title={hasPermission('update') ? 'Editar usuario' : 'Sin permisos para editar'}
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.user_id)}
                            disabled={!hasPermission('delete')}
                            className={`p-2 rounded-lg transition-colors ${hasPermission('delete')
                              ? 'bg-red-500/20 hover:bg-red-500/30 cursor-pointer'
                              : 'bg-gray-500/20 cursor-not-allowed opacity-50'
                              }`}
                            title={hasPermission('delete') ? 'Eliminar usuario' : 'Sin permisos para eliminar'}
                          >
                            <DeleteIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-slate-400 text-lg mb-2">No hay usuarios disponibles</div>
              <div className="text-slate-500 text-sm mb-4">
                {error ? 'Verifique la conexión con el servidor y la autenticación' : 'No se encontraron usuarios en la base de datos'}
              </div>
              {appMode === 'online' && (
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          {/* Mensaje cuando no hay resultados filtrados */}
          {users.length > 0 && filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <div className="text-slate-400 text-lg mb-2">No se encontraron usuarios</div>
              <div className="text-slate-500 text-sm">Prueba ajustando los filtros de búsqueda</div>
            </div>
          )}
        </div>

        {/* Modal Editar Usuario */}
        <EditUserModal
          user={editingUser}
          isOpen={editingUser !== null}
          onClose={() => setEditingUser(null)}
          onUserUpdated={handleUserCreated}
        />

        {/* Modal Agregar Usuario */}
        <AddUserModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onUserCreated={handleUserCreated}
        />
      </div>
    </div>
  )
}

export default GrifoUsuarios
//by zecsoneitor
// pagina funcionando por el poder del omnsia
