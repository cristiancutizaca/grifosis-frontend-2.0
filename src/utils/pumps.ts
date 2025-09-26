export const getPumpNumericOrder = (p: any): number => {
  const text = String(p?.pump_number ?? p?.pump_name ?? p?.nombre ?? '');
  const m = text.match(/\d+/g);
  if (m && m.length) return parseInt(m[m.length - 1], 10);
  return Number(p?.pump_id ?? p?.id ?? 0);
};