// src/constants/fuels.ts
export type FuelType = 'Diesel' | 'Premium' | 'Regular';

export const VALID_FUELS = ['Diesel', 'Premium', 'Regular'] as const;

/** IGV por tipo de combustible (usa los mismos nombres que muestra la UI) */
export const IGV_BY_FUEL: Record<FuelType, number> = {
  Diesel: 0,
  Premium: 0,
  Regular: 0,
};

/** Normaliza cualquier string al FuelType válido (fallback: 'Regular') */
export const toFuelType = (name: string): FuelType =>
  (VALID_FUELS as readonly string[]).includes(name as any)
    ? (name as FuelType)
    : 'Regular';
