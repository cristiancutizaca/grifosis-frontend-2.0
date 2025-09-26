import { normShiftForUi } from './shifts';

export type CajaEvent = {
  type: 'open' | 'close';
  timestamp: string;
  by: string;
  shift: string;
  amount?: number;
  sales?: number;
  totalInCash?: number;
  notes?: string;
};

const N = (v: any) => (v == null ? undefined : Number(v));
const S = (v: any) => (v == null ? undefined : String(v));

export const mapSessionsToEvents = (rows: any[]): CajaEvent[] => {
  const evs: CajaEvent[] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const shift = normShiftForUi(S(r.shift_name) ?? S(r.turno) ?? S(r.shift) ?? '—') as string;

    const openedByName = S(r.opened_by_name);
    const openedById   = N(r.opened_by);
    const closedByName = S(r.closed_by_name);
    const closedById   = N(r.closed_by);

    if (r?.opened_at) {
      evs.push({
        type: 'open',
        timestamp: String(r.opened_at),
        by: openedByName || (openedById != null ? `Usuario ${openedById}` : '—'),
        shift,
        amount: Number(N(r.opening_amount) ?? 0),
      });
    }
    if (r?.closed_at) {
      evs.push({
        type: 'close',
        timestamp: String(r.closed_at),
        by: closedByName || (closedById != null ? `Usuario ${closedById}` : '—'),
        shift,
        sales: Number(N(r.sales_amount) ?? 0),
        totalInCash: N(r.closing_amount) as number | undefined,
        notes: S(r.notes) ?? undefined,
      });
    }
  }

  evs.sort((a, b) => {
    const tb = new Date(b.timestamp).getTime();
    const ta = new Date(a.timestamp).getTime();
    if (tb !== ta) return tb - ta;
    const wb = b.type === 'close' ? 1 : 0;
    const wa = a.type === 'close' ? 0 : 1;
    return wb - wa;
  });
  return evs;
};
