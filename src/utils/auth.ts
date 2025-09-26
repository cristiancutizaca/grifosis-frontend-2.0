// src/utils/auth.ts
import { safeLocal, safeSession } from './safeStorage';

const STORAGE_KEY = 'token';
const isBrowser = () => typeof window !== 'undefined';

// Decode JWT sin dependencia externa (url-safe base64)
function b64decodeUrlSafe(input: string) {
  try {
    const base64 = (input || '').replace(/-/g, '+').replace(/_/g, '/');
    if (isBrowser()) {
      return decodeURIComponent(
        atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    return '{}';
  }
}

// === API pública ===
export function setToken(token: string, persistence: 'session' | 'local' = 'session') {
  // Limpia ambos para evitar estados inconsistentes
  safeSession.removeItem(STORAGE_KEY);
  safeLocal.removeItem(STORAGE_KEY);
  if (persistence === 'session') safeSession.setItem(STORAGE_KEY, token);
  else safeLocal.setItem(STORAGE_KEY, token);
}

export function getToken(): string | null {
  // Lee primero de session y luego de local
  return safeSession.getItem(STORAGE_KEY) || safeLocal.getItem(STORAGE_KEY);
}

export function clearToken() {
  safeSession.removeItem(STORAGE_KEY);
  safeLocal.removeItem(STORAGE_KEY);
}

export type JwtClaims = {
  sub?: string | number;
  id?: number;
  user_id?: number;
  role?: string;
  rol?: string;
  exp?: number;
  [k: string]: any;
};

export function getClaims(): JwtClaims | null {
  const t = getToken();
  if (!t) return null;
  try {
    const [, payload] = t.split('.');
    const json = b64decodeUrlSafe(payload || '');
    return JSON.parse(json || '{}');
  } catch {
    return null;
  }
}

export function getUserId(): number | null {
  const c = getClaims();
  const raw = c?.user_id ?? c?.id ?? (typeof c?.sub === 'string' ? parseInt(c.sub, 10) : c?.sub);
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function getUserRole(): string | null {
  const c = getClaims();
  return (c?.role || c?.rol || null) as string | null;
}

export function isAuthenticated(): boolean {
  const t = getToken();
  if (!t) return false;
  const c = getClaims();
  if (!c?.exp) return true; // si el backend no envía exp
  return Date.now() / 1000 < c.exp;
}
