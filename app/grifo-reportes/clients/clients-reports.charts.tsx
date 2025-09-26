'use client';

import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
} from 'recharts';

export type SummaryPoint = {
  period: string;          // ISO string
  gallons: number;
  revenue: number;
  revenue_credit: number;
  revenue_cash: number;
};

const tsLabel = (s: string) => new Date(s).toLocaleDateString();
const money  = (v: number) => `S/ ${v.toFixed(2)}`;

export function RevenueGallonsChart({ data }: { data: SummaryPoint[] }) {
  if (!data?.length) return null;

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3">
      <div className="mb-2 text-sm text-slate-300">Ingreso vs Galones</div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="period" tickFormatter={tsLabel} stroke="#94a3b8" />
            <YAxis yAxisId="left"  stroke="#94a3b8" />
            <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tickFormatter={(v) => money(Number(v))} />
            <Tooltip
              labelFormatter={tsLabel}
              formatter={(v, n) => [n?.toString()?.toLowerCase().includes('galon') ? Number(v) : money(Number(v)), n]}
              contentStyle={{ background: '#0f172a', borderColor: '#334155' }}
            />
            <Legend />
            <Bar  dataKey="gallons" name="Galones" yAxisId="left" />
            <Line type="monotone" dataKey="revenue" name="Ingreso" yAxisId="right" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function RevenueSplitChart({ data }: { data: SummaryPoint[] }) {
  if (!data?.length) return null;

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3">
      <div className="mb-2 text-sm text-slate-300">Crédito vs Contado</div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="period" tickFormatter={tsLabel} stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" tickFormatter={(v) => money(Number(v))} />
            <Tooltip
              labelFormatter={tsLabel}
              formatter={(v, n) => [money(Number(v)), n]}
              contentStyle={{ background: '#0f172a', borderColor: '#334155' }}
            />
            <Legend />
            <Bar dataKey="revenue_cash"   name="Contado" />
            <Bar dataKey="revenue_credit" name="Crédito" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
