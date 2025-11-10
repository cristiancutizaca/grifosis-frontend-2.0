// src/utils/jwt.ts
import { getAuthToken } from '@/app/grifo-turnos/turnos/auth';

export const decodeUserIdFromJWT = (): number | null => {
  try {
    const token = getAuthToken();
    if (!token) return null;
    const payloadStr = token.split('.')[1] || '';
    const payload = JSON.parse(
      atob(payloadStr.replace(/-/g, '+').replace(/_/g, '/'))
    );
    return Number(
      payload?.sub ?? payload?.user_id ?? payload?.id ?? null
    ) || null;
  } catch {
    return null;
  }
};
