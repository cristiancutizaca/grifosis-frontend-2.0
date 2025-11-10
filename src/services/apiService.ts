// src/services/apiService.ts

// === Helpers de auth locales (evita mezclar claves/ubicaciones) ===
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Prioriza sessionStorage (lo usa tu Layout/Login)
  const ss = sessionStorage.getItem('token');
  if (ss) return ss;

  // Compatibilidad legacy
  const lsToken = localStorage.getItem('token') || localStorage.getItem('authToken');
  if (lsToken) return lsToken;

  return null;
}

function clearAuthToken() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
  } catch {}
}

// ⬇️ exportamos la clase para quien quiera instanciar manualmente
export class ApiService {
  private baseURL: string;

  constructor(baseURL: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api') {
    this.baseURL = baseURL.replace(/\/+$/, ''); // sin barra final
  }

  // --- helpers ---
  private buildUrl(endpoint: string) {
    const ep = ('/' + endpoint).replace(/\/{2,}/g, '/'); // colapsa //
    // si el endpoint viene con /api al inicio, lo quitamos para evitar .../api/api/...
    const clean = ep.replace(/^\/api(\/|$)/, '/');
    return `${this.baseURL}${clean}`;
  }

  /** Header Authorization consistente para TODOS los endpoints (incluye /sales) */
  private authHeader(): Record<string, string> {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private headersToObject(init?: HeadersInit): Record<string, string> {
    if (!init) return {};
    return Object.fromEntries(new Headers(init));
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.buildUrl(endpoint);

    const base: Record<string, string> = {
      Accept: 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      ...this.authHeader(),
    };

    const extra = this.headersToObject(options.headers);
    const headers: Record<string, string> = { ...base, ...extra };

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    } else {
      // fetch pone el boundary automáticamente
      delete headers['Content-Type'];
    }

    const isGet = (options.method || 'GET').toUpperCase() === 'GET';

    const config: RequestInit = {
      cache: isGet ? 'no-store' : 'no-cache',
      ...options,
      headers,
    };

    try {
      const res = await fetch(url, config);

      // Manejo explícito de 401 para limpiar sesión y redirigir (opcional pero útil)
      if (res.status === 401) {
        try { await res.clone().text(); } catch {}
        clearAuthToken();
        if (typeof window !== 'undefined') {
          // evita loops: redirige fuera de rutas protegidas
          const loc = window.location?.pathname || '';
          if (loc !== '/' && !loc.startsWith('/login')) {
            window.location.href = '/?expired=1';
          }
        }
        throw new Error('No autorizado (401)');
      }

      if (!res.ok) {
        let msg = `HTTP error! status: ${res.status}`;
        try {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const errJson = await res.clone().json();
            if (errJson?.message) {
              msg = Array.isArray(errJson.message) ? errJson.message.join(', ') : errJson.message;
            } else if (errJson?.detail) {
              msg = String(errJson.detail);
            }
          } else {
            const txt = await res.clone().text();
            if (txt) msg = txt;
          }
        } catch { /* noop */ }
        throw new Error(msg);
      }

      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        // Devuelve objeto vacío si no es JSON (por ejemplo, 204 No Content)
        return {} as T;
      }

      return (await res.json()) as T;
    } catch (err: any) {
      console.error('API request failed:', err);
      const m = String(err?.message || '').toLowerCase();
      if (err instanceof TypeError && m.includes('fetch')) {
        throw new Error('Error de conexión: No se puede conectar al servidor. Verifique que el backend esté ejecutándose.');
      }
      throw err;
    }
  }

  async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const sep = endpoint.includes('?') ? '&' : '?';
    const busted = `${endpoint}${sep}_=${Date.now()}`;
    return this.request<T>(busted, { method: 'GET', ...options, cache: 'no-store' });
  }

  async post<T>(endpoint: string, data: any, options: RequestInit = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request<T>(endpoint, { method: 'POST', body, ...options });
  }

  async patch<T>(endpoint: string, data: any, options: RequestInit = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request<T>(endpoint, { method: 'PATCH', body, ...options });
  }

  async put<T>(endpoint: string, data: any, options: RequestInit = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request<T>(endpoint, { method: 'PUT', body, ...options });
  }

  async delete<T>(endpoint: string, options: RequestInit = {}) {
    return this.request<T>(endpoint, { method: 'DELETE', ...options });
  }

  async healthCheck(): Promise<boolean> {
    try { await this.get('/health'); return true; } catch { return false; }
  }

  getBaseURL() { return this.baseURL; }
  setBaseURL(newBaseURL: string) { this.baseURL = newBaseURL; }
}

// ⬇️ Exportamos una **única** instancia tanto por default como con nombre
const api = new ApiService();
export default api;   // import api from '.../apiService'
export { api };      // import { api } from '.../apiService'
