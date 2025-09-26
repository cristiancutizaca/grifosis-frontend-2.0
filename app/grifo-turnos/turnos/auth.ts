// app/grifo-turnos/turnos/auth.ts
export const getAuthToken = (): string => {
  if (typeof window === 'undefined') return '';

  // 1) Sesión actual primero (lo que guarda el login)
  const ss = sessionStorage.getItem('token');
  if (ss) return ss;

  // 2) Fallbacks por compatibilidad con código viejo
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    ''
  );
};
