/** Limpia tags técnicos de notes (p.ej. [pagado_bruto=...]) para tooltip */
export const cleanNotes = (notes?: string): string => {
  if (!notes) return '';
  return String(notes)
    .replace(/\s*\[(?:pagado_bruto|pago_bruto|importe|gross|amount_paid)=[^\]]+\]\s*/ig, '')
    .trim();
};

/** Extrae bruto desde notes: [pagado_bruto=20], [gross=20], [importe=20], [amount_paid=20] */
export const parseGrossFromNotes = (notes?: string): number | null => {
  if (!notes) return null;
  const s = String(notes);
  const m = s.match(/\b(?:pagado_bruto|pago_bruto|importe|gross|amount_paid)\s*=\s*(?:S\/\s*)?([0-9]+(?:\.[0-9]+)?)/i);
  return m ? Number(m[1]) : null;
};
