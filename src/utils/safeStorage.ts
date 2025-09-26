// src/utils/safeStorage.ts
type Store = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const isBrowser = typeof window !== 'undefined';

export const safeSession = {
  getItem(key: string): string | null {
    return isBrowser ? window.sessionStorage.getItem(key) : null;
  },
  setItem(key: string, value: string) {
    if (isBrowser) window.sessionStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (isBrowser) window.sessionStorage.removeItem(key);
  },
};

export const safeLocal = {
  getItem(key: string): string | null {
    return isBrowser ? window.localStorage.getItem(key) : null;
  },
  setItem(key: string, value: string) {
    if (isBrowser) window.localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (isBrowser) window.localStorage.removeItem(key);
  },
};
