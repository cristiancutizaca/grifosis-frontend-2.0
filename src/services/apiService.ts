// src/services/apiService.ts

// ⬇️ exportamos la clase para quien quiera instanciar manualmente
export class ApiService {
  private baseURL: string;


  
  //constructor(baseURL: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api') {

  constructor(baseURL: string = process.env.NEXT_PUBLIC_API_URL || 'https://grifosisneo.duckdns.org/api') {
    this.baseURL = baseURL.replace(/\/+$/, ''); // sin barra final
  }

  // --- helpers ---
  private buildUrl(endpoint: string) {
    const ep = ('/' + endpoint).replace(/\/{2,}/g, '/'); // colapsa //
    // si el endpoint viene con /api al inicio, lo quitamos para evitar .../api/api/...
    const clean = ep.replace(/^\/api(\/|$)/, '/');
    return `${this.baseURL}${clean}`;
  }

  private authHeader(endpoint: string): Record<string, string> {
    const token =
      (typeof window !== 'undefined' && sessionStorage.getItem('token')) ||
      (typeof window !== 'undefined' && localStorage.getItem('authToken')) ||
      null;

    if (!token || endpoint.startsWith('/sales')) return {};
    return { Authorization: `Bearer ${token}` };
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
      ...this.authHeader(endpoint),
    };

    const extra = this.headersToObject(options.headers);
    const headers: Record<string, string> = { ...base, ...extra };

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    } else {
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
      if (!res.ok) {
        let msg = `HTTP error! status: ${res.status}`;
        try {
          const errJson = await res.clone().json();
          if (errJson?.message) {
            msg = Array.isArray(errJson.message) ? errJson.message.join(', ') : errJson.message;
          }
        } catch {}
        throw new Error(msg);
      }

      const ct = res.headers.get('content-type');
      if (!ct || !ct.includes('application/json')) {
        return {} as T;
      }
      return (await res.json()) as T;
    } catch (err: any) {
      console.error('API request failed:', err);
      if (err instanceof TypeError && String(err.message).toLowerCase().includes('fetch')) {
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
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data), ...options });
  }

  async put<T>(endpoint: string, data: any, options: RequestInit = {}) {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data), ...options });
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
