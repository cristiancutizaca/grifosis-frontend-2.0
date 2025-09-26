export const decodeUserIdFromJWT = (): number | null => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Number(payload?.sub ?? payload?.user_id ?? payload?.id ?? null) || null;
  } catch {
    return null;
  }
};
