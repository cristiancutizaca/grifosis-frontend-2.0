'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Home, Users, ShoppingCart, CreditCard, Package, BarChart3, User, Clock,
  Settings, Menu, ChevronLeft, ChevronRight, Fuel
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

// Menús por rol
const MENU_ITEMS = {
  superadmin: [
    { name: 'Dashboard', icon: Home, path: '/grifo' },
    { name: 'Clientes', icon: Users, path: '/grifo-clientes' },
    { name: 'Configuración', icon: Settings, path: '/grifo-configuracion' },
    { name: 'Créditos', icon: CreditCard, path: '/grifo-creditos' },
    { name: 'Empleados', icon: Users, path: '/grifo-empleados' },
    { name: 'Inventario', icon: Package, path: '/grifo-inventario' },
    { name: 'Reportes', icon: BarChart3, path: '/grifo-reportes' },
    { name: 'Turnos', icon: Clock, path: '/grifo-turnos' },
    { name: 'Ventas', icon: ShoppingCart, path: '/grifo-ventas' },
    { name: 'Usuarios', icon: Clock, path: '/grifo-usuario' },
    { name: 'Super Admin', icon: User, path: '/super-admin' },
  ],
  admin: [
    { name: 'Dashboard', icon: Home, path: '/grifo' },
    { name: 'Clientes', icon: Users, path: '/grifo-clientes' },
    { name: 'Configuración', icon: Settings, path: '/grifo-configuracion' },
    { name: 'Créditos', icon: CreditCard, path: '/grifo-creditos' },
    { name: 'Empleados', icon: Users, path: '/grifo-empleados' },
    { name: 'Inventario', icon: Package, path: '/grifo-inventario' },
    { name: 'Reportes', icon: BarChart3, path: '/grifo-reportes' },
    { name: 'Turnos', icon: Clock, path: '/grifo-turnos' },
    { name: 'Usuarios', icon: Clock, path: '/grifo-usuario' },
    { name: 'Ventas', icon: ShoppingCart, path: '/grifo-ventas' },
  ],
  seller: [
    { name: 'Dashboard', icon: Home, path: '/grifo' },
    { name: 'Clientes', icon: Users, path: '/grifo-clientes' },
    { name: 'Ventas', icon: ShoppingCart, path: '/grifo-ventas' },
    { name: 'Inventario', icon: Package, path: '/grifo-inventario' },
    { name: 'Créditos', icon: CreditCard, path: '/grifo-creditos' },
    { name: 'Turnos', icon: Clock, path: '/grifo-turnos' },

  ]
} as const;

interface NavItem {
  name: string;
  icon: any;
  path: string;
}

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();

  // Estado de UI
  const [isDesktop, setIsDesktop] = useState(false);         // >= lg
  const [drawerOpen, setDrawerOpen] = useState(false);        // sidebar móvil (off-canvas)
  const [collapsed, setCollapsed] = useState(false);          // sidebar desktop mini

  // Auth
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Detectar breakpoint lg (>=1024px)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handle = (e: MediaQueryListEvent | MediaQueryList) => {
      const isDesk = 'matches' in e ? e.matches : (e as MediaQueryList).matches;
      setIsDesktop(isDesk);
      // al pasar a desktop: cerramos drawer y expandimos sidebar
      if (isDesk) {
        setDrawerOpen(false);
      } else {
        setCollapsed(false);
      }
    };
    handle(mql); // set inicial
    mql.addEventListener('change', handle);
    return () => mql.removeEventListener('change', handle);
  }, []);

  // Cerrar drawer móvil al navegar
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Auth
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!token) {
          router.push('/');
          return;
        }
        let role = 'seller';
        const { jwtDecode } = await import('jwt-decode');
        const decoded: any = jwtDecode(token);
        role = decoded.role || decoded.rol || 'seller';

        setUserRole(role);
        setIsLoading(false);
      } catch (error) {
        console.error('Error al verificar autenticación:', error);
        sessionStorage.removeItem('token');
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  const navItems: NavItem[] = useMemo(
    () => (MENU_ITEMS as any)[userRole as keyof typeof MENU_ITEMS] || (MENU_ITEMS as any)['seller'],
    [userRole]
  );

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'superadmin': return 'Super Admin';
      case 'admin': return 'Administrador';
      case 'seller': return 'Vendedor';
      default: return 'Usuario';
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    router.push('/');
  };

  const toggleGlobalSidebar = () => {
    if (isDesktop) setCollapsed((v) => !v); // en desktop, colapsa/expande
    else setDrawerOpen((v) => !v);          // en móvil, abre/cierra drawer
  };

  // Cargando / sin rol
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <span className="text-xl">Cargando...</span>
        </div>
      </div>
    );
  }
  if (!userRole) return null;

  // Reutilizamos la lista de navegación
  const NavList = ({ showText, onClickItem }: { showText: boolean; onClickItem?: () => void }) => (
    <ul>
      {navItems.map((item) => (
        <li key={item.name} className="mb-2">
          <Link
            href={item.path}
            onClick={onClickItem}
            className={`w-full flex items-center p-2 rounded-lg hover:bg-slate-700 transition-colors ${
              pathname === item.path ? 'bg-orange-500 text-white' : 'text-slate-300'
            }`}
          >
            <item.icon size={20} className="mr-3 shrink-0" />
            {showText && <span className="truncate">{item.name}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex min-h-screen bg-slate-900 text-white">
      {/* ---------- Drawer móvil (off-canvas) ---------- */}
      {/* Overlay */}
      {!isDesktop && drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      {/* Sidebar móvil */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-slate-800 p-4 transition-transform duration-300 lg:hidden
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Menú de navegación"
      >
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mr-3">
            <Fuel size={24} />
          </div>
          <h1 className="text-xl font-bold">Gas Station</h1>
        </div>
        <nav className="overflow-y-auto">
          <NavList showText onClickItem={() => setDrawerOpen(false)} />
        </nav>
        <div className="mt-4">
          <button
            onClick={handleLogout}
            className="w-full p-2 rounded-lg text-slate-200 bg-red-600 hover:bg-red-700 transition-colors text-sm"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ---------- Sidebar desktop persistente ---------- */}
      <aside
        className={`hidden lg:flex lg:flex-col bg-slate-800 p-4 transition-all duration-300
        ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mr-3">
            <Fuel size={24} />
          </div>
          {!collapsed && <h1 className="text-xl font-bold">Gas Station</h1>}
        </div>
        <nav className="flex-1 overflow-y-auto">
          <NavList showText={!collapsed} />
        </nav>
        <div className="mt-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="w-full p-2 rounded-lg text-slate-300 hover:bg-slate-700 flex items-center justify-center transition-colors mb-2"
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!collapsed && <span className="ml-2">Colapsar</span>}
          </button>
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="w-full p-2 rounded-lg text-slate-200 bg-red-600 hover:bg-red-700 transition-colors text-sm"
            >
              Cerrar Sesión
            </button>
          )}
        </div>
      </aside>

      {/* ---------- Contenido ---------- */}
      <main className="flex-1 p-0 overflow-y-auto bg-slate-900">
        <header className="flex justify-between items-center p-4 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleGlobalSidebar}
              className="p-2 text-white hover:bg-slate-700 rounded-lg transition-colors"
              aria-label={isDesktop ? (collapsed ? 'Expandir menú' : 'Colapsar menú') : (drawerOpen ? 'Cerrar menú' : 'Abrir menú')}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg sm:text-xl font-semibold text-white">
              {getRoleDisplayName(userRole)}
            </h1>
          </div>
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="hidden sm:block bg-red-500 text-white px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">
              10
            </div>
            <span className="hidden sm:block text-slate-300 text-sm">
              {getRoleDisplayName(userRole)}
            </span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-500 rounded-full flex items-center justify-center">
              <User size={18} className="text-white" />
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
