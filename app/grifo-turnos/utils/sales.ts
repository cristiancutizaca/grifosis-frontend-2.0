// app/grifo-turnos/utils/sales.ts

import { getPaymentLabel } from './../../../src/constants/payments';

export type TotalsByMethod = {
  efectivo: number;
  tarjeta: number;
  yapeplin: number;
  credito: number;
};

const n = (v: any) => Number(v ?? 0) || 0;

/** Total NETO del turno (usa amountNet/final_amount/total_amount) */
export const calcTotalVentasTurno = (arr: any[]): number =>
  arr.reduce((acc, s) => acc + n(s._ui?.amountNet ?? s.final_amount ?? s.total_amount), 0);

/** Total BRUTO del turno (prefiere amountGross y cae a Net si no existe) */
export const calcTotalVentasTurnoBruto = (arr: any[]): number =>
  arr.reduce(
    (acc, s) =>
      acc + n(s._ui?.amountGross ?? s._ui?.amountNet ?? s.final_amount ?? s.total_amount),
    0
  );

/** ¿La venta es a crédito? */
export const isCredit = (s: any): boolean => {
  const label =
    String(s._ui?.paymentLabel ?? getPaymentLabel(s) ?? s.payment_method ?? '').toLowerCase();
  return label.includes('crédito') || label.includes('credito') || label.includes('credit');
};

/** Suma por método de pago para el bloque "Desglose por método" */
export const buildTotalsByMethod = (sales: any[]): TotalsByMethod => {
  const res: TotalsByMethod = { efectivo: 0, tarjeta: 0, yapeplin: 0, credito: 0 };

  for (const s of sales) {
    const label =
      String(s._ui?.paymentLabel ?? getPaymentLabel(s) ?? s.payment_method ?? '').toLowerCase();
    const amount = n(s._ui?.amountGross ?? s._ui?.amountNet ?? s.final_amount ?? s.total_amount);

    if (label.includes('tarjeta') || label.includes('pos')) {
      res.tarjeta += amount;
    } else if (label.includes('yape') || label.includes('plin')) {
      res.yapeplin += amount;
    } else if (label.includes('crédito') || label.includes('credito') || label.includes('credit')) {
      res.credito += amount;
    } else {
      // por defecto, efectivo
      res.efectivo += amount;
    }
  }

  // redondeo 2 decimales
  return {
    efectivo: Number(res.efectivo.toFixed(2)),
    tarjeta: Number(res.tarjeta.toFixed(2)),
    yapeplin: Number(res.yapeplin.toFixed(2)),
    credito: Number(res.credito.toFixed(2)),
  };
};
