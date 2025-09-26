// utils/gallons.ts
export async function gallons(scope: 'day'|'month'|'year' = 'day', at?: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const url = `/reports/sales/gallons?scope=${scope}${at ? `&at=${at}` : ''}`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error('No se pudo obtener galones');
  const data = await res.json(); // { scope, at, gallons }
  return data.gallons as number;
}


//import { gallons } from '../../src/utils/gallons';

//const totalHoy = await gallons('day');        // galones de hoy
//const totalMes = await gallons('month');      // galones del mes actual
//const totalAño = await gallons('year', '2025-01-01'); // del año 2025
