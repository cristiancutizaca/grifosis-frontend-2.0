// src/utils/text.ts

/**
 * Limpia etiquetas técnicas incrustadas en notes, por ejemplo:
 * [pagado_bruto=20], [pago_bruto=20], [importe=20], [gross=20], [amount_paid=20]
 * También tolera "S/ " delante del número y espacios alrededor del '='.
 *
 * Devuelve un string "bonito" para tooltips/etiquetas de la UI.
 */
export function cleanNotes(notes?: string): string {
  if (!notes) return '';
  return String(notes)
    // quita las etiquetas técnicas
    .replace(
      /\s*\[(?:pagado_bruto|pago_bruto|importe|gross|amount_paid)\s*=\s*(?:S\/\s*)?[^\]]+\]\s*/gi,
      ''
    )
    // normaliza espacios
    .replace(/\s+/g, ' ')
    .trim();
}
