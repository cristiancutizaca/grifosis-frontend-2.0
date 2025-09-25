// src/common/date.util.ts
/** Devuelve la fecha de hoy en Lima en formato YYYY-MM-DD sin dependencias. */
export function todayLima(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }); // 'YYYY-MM-DD'
}
