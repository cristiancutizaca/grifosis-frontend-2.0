'use client';

import React from 'react';
import { X, Fuel } from 'lucide-react';
import GenerarReporteButton from '../components/reportes/GenerarReporteButton';

/* ✅ Tipos */
export type Row = {
  fuel: 'Regular' | 'Premium' | 'Diesel' | string;
  gallons: number;
  gross: number;
};

type CreditClientRow = {
  client: string;
  fuel: string;
  gallons?: number;
  gross: number;
};

type MethodDetailRow = { product: string; gallons: number; gross: number };
type MethodDetail = {
  label: string;
  rows: MethodDetailRow[];
  totalGallons: number;
  totalGross: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  shift: string;
  dayLabel?: string;

  rows: Row[];
  totalGross: number;
  totalGallons: number;

  creditRows?: Row[];
  creditTotalGross?: number;
  creditTotalGallons?: number;

  creditClients?: CreditClientRow[];
  methodDetails?: MethodDetail[];

  openingAmount?: number;
  cashOnHand?: number;
}

const DetalleVentasModal: React.FC<Props> = ({
  open,
  onClose,
  shift,
  dayLabel,
  rows,
  totalGross,
  totalGallons,
  creditRows = [],
  creditTotalGross = 0,
  creditTotalGallons = 0,
  creditClients = [],
  methodDetails = [],
  openingAmount,
  cashOnHand,
}) => {
  if (!open) return null;

  const fmt2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');
  const capWords = (s?: string) =>
    (s ?? '')
      .split(' ')
      .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');

  // === Tabla compacta UI ===
  const Table = ({
    title,
    data,
    gallonsTotal,
    grossTotal,
  }: {
    title: string;
    data: Row[];
    gallonsTotal: number;
    grossTotal: number;
  }) => (
    <>
      <div className="mb-2 text-[13px] font-semibold text-white">{title}</div>
      {data.length === 0 ? (
        <div className="mb-4 rounded-xl border border-white/10 bg-slate-900/40 p-4 text-center text-slate-300">
          Sin ventas registradas en este turno.
        </div>
      ) : (
        <div className="mb-4 overflow-hidden rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-xs">
            <thead className="bg-slate-900/60">
              <tr className="text-left uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Galones</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-[#0B1220]">
              {data.map((r, idx) => (
                <tr key={`${r.fuel}-${idx}`}>
                  <td className="px-3 py-2 text-slate-200">
                    <span className="mr-2 inline-flex rounded-md bg-slate-900/70 p-1">
                      <Fuel className="h-3.5 w-3.5 text-sky-300" />
                    </span>
                    {capWords(r.fuel)}
                  </td>
                  <td className="px-3 py-2 text-slate-200">{fmt2(r.gallons)} gal</td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-400">S/ {fmt2(r.gross)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900/60">
              <tr>
                <td className="px-3 py-2 font-semibold text-slate-200">Totales</td>
                <td className="px-3 py-2 font-semibold text-slate-200">{fmt2(gallonsTotal)} gal</td>
                <td className="px-3 py-2 text-right font-extrabold text-emerald-400">S/ {fmt2(grossTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="
          relative z-[101] w-full max-w-3xl md:max-w-4xl
          rounded-2xl border border-white/10 bg-[#0F172A]
          shadow-[0_20px_60px_rgba(0,0,0,.55)]
          max-h-[85vh] flex flex-col
        "
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white sm:text-lg">
              Detalle de ventas por producto
            </h3>
            <div className="mt-1 text-[11px] text-slate-300">
              Turno <span className="font-semibold">{shift}</span>
              {dayLabel ? <> · {dayLabel}</> : null}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <Table
            title="Ventas cobradas (sin crédito)"
            data={rows}
            gallonsTotal={totalGallons}
            grossTotal={totalGross}
          />

          {(creditRows?.length ?? 0) > 0 || (creditTotalGross ?? 0) > 0 ? (
            <Table
              title="Detalle de ventas en crédito"
              data={creditRows ?? []}
              gallonsTotal={creditTotalGallons ?? 0}
              grossTotal={creditTotalGross ?? 0}
            />
          ) : null}

          {methodDetails.length > 0 && (
            <div className="mt-1">
              {methodDetails
                .filter(m => !/(cr[eé]dito|credit|efectivo|cash|contado)/i.test(m?.label ?? ''))
                .map((m, i) => (
                  <Table
                    key={i}
                    title={capWords(m.label || '—')}
                    data={m.rows.map(r => ({
                      fuel: capWords(r.product),
                      gallons: r.gallons,
                      gross: r.gross,
                    }))}
                    gallonsTotal={m.totalGallons}
                    grossTotal={m.totalGross}
                  />
                ))}
            </div>
          )}

          {creditClients.length > 0 && (
            <div className="mt-1">
              <div className="mb-2 text-[13px] font-semibold text-white">
                Detalle de créditos por cliente
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-xs">
                  <thead className="bg-slate-900/60">
                    <tr className="text-left uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2 text-right">Galones</th>
                      <th className="px-3 py-2 text-right">Monto (Bruto)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-[#0B1220]">
                    {creditClients.map((c, idx) => (
                      <tr key={`${c.client}-${idx}`}>
                        <td className="px-3 py-2 text-slate-200">{c.client || '—'}</td>
                        <td className="px-3 py-2 text-slate-200">{capWords(c.fuel || '—')}</td>
                        <td className="px-3 py-2 text-right text-slate-200">
                          {(c.gallons ?? 0) > 0 ? `${fmt2(c.gallons!)} gal` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-400">
                          S/ {fmt2(c.gross || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0F172A] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <GenerarReporteButton
              shift={shift}
              dayLabel={dayLabel}
              rows={rows}
              totalGross={totalGross}
              totalGallons={totalGallons}
              creditRows={creditRows}
              creditTotalGross={creditTotalGross}
              creditTotalGallons={creditTotalGallons}
              creditClients={creditClients}
              methodDetails={methodDetails}
              openingAmount={openingAmount}
              cashOnHand={cashOnHand}
            >
              Generar reporte
            </GenerarReporteButton>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetalleVentasModal;
