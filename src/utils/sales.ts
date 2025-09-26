// src/utils/sales.ts

/** Quita tags técnicos de notes para mostrar en tooltips/ UI */
export const cleanNotes = (notes?: string): string => {
  if (!notes) return '';
  return String(notes)
    .replace(
      /\s*\[(?:pagado_bruto|pago_bruto|importe|gross|amount_paid)=[^\]]+\]\s*/gi,
      ''
    )
    .trim();
};

/** Extrae el monto bruto guardado en notes (p. ej. [pagado_bruto=20]) */
export const parseGrossFromNotes = (notes?: string): number | null => {
  if (!notes) return null;
  const s = String(notes);
  const m = s.match(
    /\b(?:pagado_bruto|pago_bruto|importe|gross|amount_paid)\s*=\s*(?:S\/\s*)?([0-9]+(?:\.[0-9]+)?)/i
  );
  return m ? Number(m[1]) : null;
};

/** Normaliza array | {data: array} | null a array */
export const asArray = <T = any>(val: any): T[] => {
  if (Array.isArray(val)) return val as T[];
  if (val && typeof val === 'object' && Array.isArray((val as any).data)) {
    return (val as any).data as T[];
  }
  return [];
};
