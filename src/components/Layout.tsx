'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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

// ===== Auto-logout SIN .env =====
const DEFAULT_IDLE_MINUTES = 10; // cambia si quieres otro default
const LAST_ACTIVITY_KEY = 'app:last-activity-ms';
const AUTH_BC = 'auth';

// Permite override en runtime: localStorage.setItem('idle-minutes','1')
function getIdleMinutes(): number {
  if (typeof window !== 'undefined') {
    const raw = (localStorage.getItem('idle-minutes') ?? '').trim();
    const n = Number.parseInt(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_IDLE_MINUTES;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();

  // Estado de UI
  const [isDesktop, setIsDesktop] = useState(false);         // >= lg
  const [drawerOpen, setDrawerOpen] = useState(false);        // sidebar móvil
  const [collapsed, setCollapsed] = useState(false);          // sidebar desktop mini

  // Auth
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Refs para idle
  const lastActivityRef = useRef<number>(Date.now());
  const singleShotTimerRef = useRef<number | null>(null);
  const watchdogIntervalRef = useRef<number | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  // Helpers logout
  const clearAuth = useCallback(() => {
    try {
      sessionStorage.clear();           // mata toda la sesión
      localStorage.removeItem('token'); // por compatibilidad si alguna vez lo usaste
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
    } catch {}
  }, []);

  const broadcastLogout = useCallback(() => {
    try {
      const bc = new BroadcastChannel(AUTH_BC);
      bc.postMessage({ type: 'force-logout' });
      bc.close();
    } catch {}
    // Fallback por storage (navegadores sin BroadcastChannel)
    try { localStorage.setItem('force-logout-ts', String(Date.now())); } catch {}
  }, []);

  // Redirección dura a prueba de balas → '/'
  const hardRedirectLogin = useCallback(() => {
    if (typeof window !== 'undefined') {
      try { window.location.href = '/'; return; } catch {}
      try { window.location.assign('/'); return; } catch {}
      setTimeout(() => {
        try { window.history.pushState(null, '', '/'); } catch {}
        window.location.reload();
      }, 60);
    }
  }, []);

  const logoutEverywhere = useCallback(() => {
    clearAuth();
    broadcastLogout();
    hardRedirectLogin();
  }, [broadcastLogout, clearAuth, hardRedirectLogin]);

  // Detectar breakpoint lg (>=1024px)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handle = (e: MediaQueryListEvent | MediaQueryList) => {
      const isDesk = 'matches' in e ? e.matches : (e as MediaQueryList).matches;
      setIsDesktop(isDesk);
      if (isDesk) setDrawerOpen(false);
      else setCollapsed(false);
    };
    handle(mql); // set inicial
    mql.addEventListener('change', handle);
    return () => mql.removeEventListener('change', handle);
  }, []);

  // Cerrar drawer móvil al navegar
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Auth (revisa token y obtiene rol)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!token) { router.push('/'); return; }
        let role = 'seller';
        const { jwtDecode } = await import('jwt-decode');
        const decoded: any = jwtDecode(token);
        role = decoded.role || decoded.rol || 'seller';
        setUserRole(role);
        setIsLoading(false);
      } catch (error) {
        console.error('Error al verificar autenticación:', error);
        sessionStorage.removeItem('token');
        router.push('/');
      }
    };
    checkAuth();
  }, [router]);

  // ==== Auto-logout por inactividad ====
  useEffect(() => {
    if (isLoading || !userRole) return; // solo cuando ya estás dentro

    const minutes = getIdleMinutes();
    const timeoutMs = Math.max(1, minutes) * 60 * 1000;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
      try { localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivityRef.current)); } catch {}
      // reinicia temporizador de un solo disparo
      if (singleShotTimerRef.current) window.clearTimeout(singleShotTimerRef.current);
      singleShotTimerRef.current = window.setTimeout(() => {
        const now = Date.now();
        if (now - lastActivityRef.current >= timeoutMs) {
          logoutEverywhere();
        }
      }, timeoutMs) as unknown as number;
    };

    // inicial
    markActivity();

    // eventos de actividad
    const evs = ['mousemove','mousedown','keydown','scroll','touchstart','pointerdown','wheel'];
    evs.forEach(ev => window.addEventListener(ev, markActivity, { passive: true }));

    // watchdog (por si algo limpia el timeout)
    watchdogIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current >= timeoutMs) {
        logoutEverywhere();
      }
    }, 15_000) as unknown as number;

    // sync entre pestañas por storage y broadcast
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        const v = Number(e.newValue);
        if (!Number.isNaN(v)) lastActivityRef.current = v;
      }
      if (e.key === 'force-logout-ts' && e.newValue) {
        logoutEverywhere();
      }
    };
    window.addEventListener('storage', onStorage);

    try {
      bcRef.current = new BroadcastChannel(AUTH_BC);
      bcRef.current.onmessage = (msg) => {
        if (msg?.data?.type === 'force-logout') logoutEverywhere();
      };
    } catch {}

    return () => {
      evs.forEach(ev => window.removeEventListener(ev, markActivity));
      window.removeEventListener('storage', onStorage);
      if (singleShotTimerRef.current) window.clearTimeout(singleShotTimerRef.current);
      if (watchdogIntervalRef.current) window.clearInterval(watchdogIntervalRef.current);
      try { bcRef.current?.close(); } catch {}
    };
  }, [isLoading, userRole, logoutEverywhere]);

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
    clearAuth();
    broadcastLogout();
    hardRedirectLogin();
  };

  const toggleGlobalSidebar = () => {
    if (isDesktop) setCollapsed((v) => !v);
    else setDrawerOpen((v) => !v);
  };

  // Cargando / sin rol (solo para rutas protegidas)
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
      {!isDesktop && drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
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
