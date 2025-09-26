// src/sales/sales.totals.ts
export type SaleCalcInput = {
  unit_price: number;     // precio unitario
  quantity: number;       // cantidad
  discount_amount?: number; // descuento absoluto (moneda)
  igv_rate?: number;      // p.ej. 0.18
  price_includes_tax?: boolean; // si el precio ya viene con IGV incluido
};

export type SaleCalcOutput = {
  subtotal: number;       // base imponible antes de IGV y descuento
  discount_amount: number;
  tax_amount: number;     // IGV
  final_amount: number;   // total a pagar
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Cálculo robusto de totales. Por defecto, el precio NO incluye IGV. */
export function computeSaleTotals(input: SaleCalcInput): SaleCalcOutput {
  const unit = Number(input.unit_price || 0);
  const qty  = Number(input.quantity || 0);
  const disc = round2(Number(input.discount_amount || 0));
  const rate = Number(input.igv_rate ?? 0);

  if (input.price_includes_tax) {
    // Caso A: precio YA incluye IGV (común en retail).
    const gross = Math.max(0, round2(unit * qty) - disc); // total con IGV
    const tax   = round2(rate > 0 ? (gross * rate) / (1 + rate) : 0);
    const net   = round2(gross - tax);
    return {
      subtotal: net,
      discount_amount: disc,
      tax_amount: tax,
      final_amount: gross,
    };
  } else {
    // Caso B: precio NO incluye IGV (común en B2B).
    const subtotal = round2(unit * qty);
    const taxable  = Math.max(0, subtotal - disc);
    const tax      = round2(taxable * rate);
    const total    = round2(taxable + tax);
    return {
      subtotal,
      discount_amount: disc,
      tax_amount: tax,
      final_amount: total,
    };
  }
}
