// app/grifo-turnos/turnos/auth.ts
export const getAuthToken = (): string => {
  if (typeof window === 'undefined') return '';
  const ss = sessionStorage.getItem('token');
  if (ss) return ss;
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    ''
  );
};
