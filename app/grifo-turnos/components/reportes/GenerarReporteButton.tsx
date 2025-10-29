'use client';

import React from 'react';
import cashBoxService from '../../../../src/services/cashBoxService';
import { buildMetersData } from './meters';

/* ========================= Tipos ========================= */
export type Row = { fuel: 'Regular' | 'Premium' | 'Diesel' | string; gallons: number; gross: number };
type CreditClientRow = { client: string; fuel: string; gallons?: number; gross: number };
type MethodDetailRow = { product: string; gallons: number; gross: number };
type MethodDetail = { label: string; rows: MethodDetailRow[]; totalGallons: number; totalGross: number };

export interface GenerarReporteButtonProps {
  shiftId?: string;
  shift?: string;        // nombre visible del turno (legacy)
  dayLabel?: string;     // 'DD/MM/YYYY' o 'YYYY-MM-DD'

  rows: Row[];
  totalGross: number;
  totalGallons: number;

  creditRows?: Row[];
  creditTotalGross?: number;
  creditTotalGallons?: number;

  creditClients?: CreditClientRow[];
  methodDetails?: MethodDetail[];

  openingAmount?: number; // fallback si BD no tuviera apertura
  cashOnHand?: number;    // fallback si UI ya lo tiene

  className?: string;
  title?: string;
  children?: React.ReactNode;
}

/* ========================= Utils compactas ========================= */
const fmt2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');

const parseYmdFromLabel = (s?: string): string | null => {
  if (!s) return null;
  const x = s.trim();
  let m = x.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = x.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);     // YYYY-MM-DD
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
};

const todayYmd = () =>
  new Date()
    .toLocaleString('sv-SE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' })
    .slice(0, 10);

const tsNum = (raw?: any) => {
  const v = raw?.timestamp || raw?.created_at || raw?.createdAt || raw?.closed_at || raw?.opened_at || raw?.date || '';
  const s = String(v);
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : -Infinity;
};

const isOpenEvt = (e: any) => {
  const type = String(e?.type ?? e?.evento ?? e?.action ?? e?.status ?? '').toLowerCase();
  return /(open|apert|abr|apertura de caja|caja abierta)/i.test(type);
};
const isCloseEvt = (e: any) => {
  const type = String(e?.type ?? e?.evento ?? e?.action ?? e?.status ?? '').toLowerCase();
  return /(close|cierre|cerr|cash_close|caja cerrada)/i.test(type);
};

/* === Fallbacks para leer montos de la UI si no vienen por props ni BD === */
const parseMoneySmart = (input: string): number => {
  let t = String(input ?? '').replace(/[^0-9.,-]/g, '');
  const lastComma = t.lastIndexOf(','), lastDot = t.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    const decSep = lastComma > lastDot ? ',' : '.', thouSep = decSep === ',' ? '.' : ',';
    t = t.split(thouSep).join('').replace(decSep, '.');
  } else if (lastComma !== -1) t = t.replace(/,/g, '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
};

const readInputNextToLabel = (labelRegex: RegExp): number => {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('label,div,p,span,strong'));
  for (const el of nodes.filter(n => labelRegex.test((n.textContent || '').trim()))) {
    if (el.tagName.toLowerCase() === 'label') {
      const id = el.getAttribute('for');
      if (id) {
        const target = document.getElementById(id) as HTMLInputElement | null;
        const v = target ? parseMoneySmart(target.value || '') : NaN;
        if (Number.isFinite(v)) return v;
      }
    }
    let sib = el.nextElementSibling as HTMLElement | null;
    for (let i = 0; i < 6 && sib; i++) {
      if (sib.tagName.toLowerCase() === 'input') {
        const v = parseMoneySmart((sib as HTMLInputElement).value || '');
        if (Number.isFinite(v)) return v;
      }
      const inp = sib.querySelector('input') as HTMLInputElement | null;
      if (inp) {
        const v = parseMoneySmart(inp.value || '');
        if (Number.isFinite(v)) return v;
      }
      sib = sib.nextElementSibling as any;
    }
  }
  return NaN;
};

const readCashFromUI = (): number => {
  const v1 = readInputNextToLabel(/^\s*en\s*caja\s*$/i);
  if (Number.isFinite(v1)) return v1;
  const v2 = readInputNextToLabel(/en\s*caja/i);
  if (Number.isFinite(v2)) return v2;
  const ph = document.querySelector<HTMLInputElement>('input[placeholder*="En caja" i]');
  if (ph) {
    const v = parseMoneySmart(ph.value || '');
    if (Number.isFinite(v)) return v;
  }
  return NaN;
};

/* ========================= Componente ========================= */
const GenerarReporteButton: React.FC<GenerarReporteButtonProps> = ({
  shiftId, shift, dayLabel,
  rows, totalGross, totalGallons,
  creditRows = [], creditTotalGross = 0, creditTotalGallons = 0,
  creditClients = [], methodDetails = [],
  openingAmount, cashOnHand,
  className, title, children
}) => {
  const [downloading, setDownloading] = React.useState(false);
  const dayYmd = React.useMemo(() => parseYmdFromLabel(dayLabel) ?? todayYmd(), [dayLabel]);

  const getCashOnHand = (): number => {
    if (Number.isFinite(Number(cashOnHand))) return Number(cashOnHand);
    const ui = readCashFromUI();
    return Number.isFinite(ui) ? ui : 0;
  };

  const fetchOpeningAmount = async (): Promise<number> => {
    try {
      const day = await cashBoxService.historyDay(dayYmd);
      const events: any[] = Array.isArray((day as any)?.events) ? (day as any).events : [];
      const opens = events.filter(isOpenEvt).sort((a, b) => tsNum(a) - tsNum(b));
      const closes = events.filter(isCloseEvt).sort((a, b) => tsNum(a) - tsNum(b));
      const tClose = closes.length ? tsNum(closes.at(-1)) : Date.now(); // caja abierta => vista en vivo
      const openPrev = opens.filter(o => tsNum(o) <= tClose).pop();
      const val = Number(openPrev?.amount ?? openPrev?.opening_amount);
      if (Number.isFinite(val)) return val;
    } catch {}
    if (Number.isFinite(Number(openingAmount))) return Number(openingAmount);
    // último intento: leer de la UI
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,div,span,p,td,th'));
    for (const el of nodes) {
      if (/monto\s*inicial/i.test(el.textContent || '')) {
        const v = parseMoneySmart(el.textContent || '');
        if (Number.isFinite(v)) return v;
      }
    }
    return 0;
  };

  /** Bloqueo: exige que la caja del día esté cerrada */
  const ensureDayClosed = async () => {
    try {
      const day = await cashBoxService.historyDay(dayYmd);
      const events: any[] = Array.isArray((day as any)?.events) ? (day as any).events : [];
      const lastOpenTs = Math.max(...events.filter(isOpenEvt).map(tsNum), -Infinity);
      const lastCloseTs = Math.max(...events.filter(isCloseEvt).map(tsNum), -Infinity);

      if (lastCloseTs > -Infinity && lastCloseTs >= lastOpenTs) {
        return { ok: true, reason: null as null };
      }
      return { ok: false, reason: 'OPEN_SESSION' as const };
    } catch {
      // si no hay historial, mejor no permitir
      return { ok: false, reason: 'NO_HISTORY' as const };
    }
  };

  const handleGeneratePdf = async () => {
    // nuevo guard: caja cerrada
    const closed = await ensureDayClosed();
    if (!closed.ok) {
      alert('No se puede generar el reporte todavía.\n\nPrimero cierra la caja del día (incluye cierres posmedianoche).');
      return;
    }

    try {
      setDownloading(true);
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default as any;

      const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const MX = 44, MY = 52, COL_GAP = 14, LINE_THIN = 0.2, CELL_VPAD = 2;
      const dark = '#0B1220', soft = '#334155';

      const efectivo = (methodDetails || []).find(m => /(efectivo|cash|contado)/i.test(m?.label || ''));
      const efectivoVendido = Number(efectivo?.totalGross ?? 0);
      const enCaja = getCashOnHand();
      const montoInicial = await fetchOpeningAmount();

      // Cabecera
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text('REPORTE DE VENTAS', MX, MY);

      const meters = await buildMetersData(dayYmd);
      const tsNow = new Date().toLocaleString('es-PE', { hour12: false });
      const fmtTs = (t: number) => new Date(t).toLocaleString('es-PE', { hour12: false });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(
        `Fecha: ${dayLabel ?? meters.ymd}   Turno: ${shift ?? ''}   Apertura: ${meters.ok ? fmtTs(meters.tOpen!) : '—'}   Cierre: ${meters.ok ? fmtTs(meters.tClose!) : '—'}   Generado: ${tsNow}`,
        MX, MY + 16
      );
      doc.setDrawColor(soft); doc.setLineWidth(LINE_THIN);
      doc.line(MX, MY + 24, pageW - MX, MY + 24);

      const ensureSpace = (yTarget: number, estimated = 120) => {
        const bottomSafe = pageH - 90;
        if (yTarget + estimated > bottomSafe) { doc.addPage(); return MY; }
        return yTarget;
      };
      const title = (t: string, y: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(t, MX, y); return y + 10; };
      const tableBase = () => ({
        headStyles: { fillColor: dark, textColor: '#fff', fontStyle: 'bold' as const, fontSize: 8, lineWidth: LINE_THIN, lineColor: '#d1d5db' },
        styles: { fontSize: 8.5, cellPadding: { top: CELL_VPAD, bottom: CELL_VPAD, left: 5, right: 5 }, minCellHeight: 11, lineWidth: LINE_THIN, lineColor: '#d1d5db', halign: 'left' as const, valign: 'middle' as const },
        alternateRowStyles: { fillColor: '#f8fafc' },
        margin: { left: MX, right: MX },
        tableWidth: pageW - MX - MX,
        theme: 'grid' as const,
      });

      let y = MY + 40;

      // MEDIDORES
      y = title('MEDIDORES (apertura / cierre por boquilla)', y);
      if (!meters.ok) {
        doc.setFontSize(9); doc.text('No se encontró un intervalo válido de apertura/cierre para este turno.', MX, y + 6);
        y += 24;
      } else {
        for (const pumpName of Object.keys(meters.byPump || {}).sort()) {
          y = ensureSpace(y, 160);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(pumpName, MX, y); y += 6;

          const head = [['Producto', 'Boq.', 'Apertura (gal)', 'Cierre (gal)', 'Dif. (gal)', 'Total (S/)']];
          const body: any[][] = [];
          let subGall = 0, subTotal = 0;

          for (const r of (meters.byPump[pumpName] || [])) {
            const diffStr = r.diff != null ? r.diff.toFixed(2) : '';
            const totStr = r.total != null ? fmt2(r.total) : '0.00';
            body.push([String(r.product ?? '—'), String(r.nozzle ?? '—'),
              r.open != null ? r.open.toFixed(2) : '', r.close != null ? r.close.toFixed(2) : '', diffStr, totStr]);
            if (Number.isFinite(r.diff)) subGall += r.diff!;
            subTotal += r.total || 0;
          }

          const foot = [[{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, '', '', '', `${subGall.toFixed(3)}`, `S/ ${fmt2(subTotal)}`]];
          (autoTable as any)(doc, { ...tableBase(), startY: y + 6, head, body, foot,
            columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } } });
          y = (doc as any).lastAutoTable.finalY + 16;
        }

        (autoTable as any)(doc, { ...tableBase(), startY: y,
          head: [['Concepto', 'Galones', 'Total (S/)']],
          body: [['TOTAL MEDIDORES', meters.grand.gallons.toFixed(3), `S/ ${fmt2(meters.grand.total)}`]],
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } });
        y = (doc as any).lastAutoTable.finalY + 20;
      }

      // VENTAS (dos columnas)
      const colW = (pageW - MX - MX - COL_GAP) / 2;
      let yLeft = y, yRight = y;

      const drawTableCol = (side: 'left' | 'right', ttl: string, head: any[][], body: any[][], foot?: any[][]) => {
        const x = side === 'left' ? MX : MX + colW + COL_GAP;
        let yStart = side === 'left' ? yLeft : yRight;
        if (yStart === y) yStart = title('VENTAS POR PRODUCTO', yStart);
        yStart = ensureSpace(yStart);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.text(ttl, x, yStart); yStart += 8;
        (autoTable as any)(doc, { ...tableBase(), margin: { left: x, right: pageW - x - colW }, tableWidth: colW, startY: yStart, head, body, foot,
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } });
        const fin = (doc as any).lastAutoTable.finalY + 20;
        if (side === 'left') yLeft = fin; else yRight = fin;
      };

      const drawTableFull = (ttl: string, head: any[][], body: any[][], foot?: any[][]) => {
        let yStart = Math.max(yLeft, yRight);
        yStart = ensureSpace(yStart, 160);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text(ttl, MX, yStart); yStart += 8;
        (autoTable as any)(doc, { ...tableBase(), startY: yStart, head, body, foot,
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } });
        const fin = (doc as any).lastAutoTable.finalY + 20; yLeft = fin; yRight = fin;
      };

      const bodyNoCredit = (rows.length ? rows : [{ fuel: '—', gallons: 0, gross: 0 }])
        .map(r => [String(r.fuel || '—'), `${fmt2(r.gallons)} gal`, `S/ ${fmt2(r.gross)}`]);
      drawTableCol('left', 'Ventas cobradas (sin crédito)', [['Producto', 'Galones', 'Total']], bodyNoCredit,
        [['Totales', `${fmt2(totalGallons)} gal`, `S/ ${fmt2(totalGross)}`]]);

      const hasCredit = (creditRows?.length ?? 0) > 0 || (creditTotalGross ?? 0) > 0;
      const bodyCredit = (creditRows ?? []).map(r => [String(r.fuel || '—'), `${fmt2(r.gallons)} gal`, `S/ ${fmt2(r.gross)}`]);
      drawTableCol('right', 'Ventas en CRÉDITO', [['Producto', 'Galones', 'Total']],
        hasCredit ? bodyCredit : [['—', '0.00 gal', `S/ ${fmt2(0)}`]],
        [['Totales', `${fmt2(creditTotalGallons)} gal`, `S/ ${fmt2(creditTotalGross)}`]]);

      if ((creditClients?.length ?? 0) > 0) {
        const body = creditClients!.map(c => [c.client || '—', String(c.fuel || '—'),
          (c.gallons ?? 0) > 0 ? `${fmt2(c.gallons!)} gal` : '—', `S/ ${fmt2(c.gross || 0)}`]);
        drawTableFull('DETALLE DE CRÉDITOS POR CLIENTE', [['Cliente', 'Producto', 'Galones', 'Monto (Total)']], body);
      }

      const filteredMethods = (methodDetails || []).filter(
        m => !/(cr[eé]dito|credit|efectivo|cash|contado)/i.test(m?.label ?? '')
      );

      const totGallons = totalGallons + (creditTotalGallons ?? 0);
      const totGross = totalGross + (creditTotalGross ?? 0);
      const summaryBody: any[][] = [
        ['Contado', `${fmt2(totalGallons)} gal`, `S/ ${fmt2(totalGross)}`],
        ['Crédito', `${fmt2(creditTotalGallons)} gal`, `S/ ${fmt2(creditTotalGross)}`],
        ...filteredMethods.map(m => [String(m.label || '—'), `${fmt2(m.totalGallons)} gal`, `S/ ${fmt2(m.totalGross)}`]),
        ['TOTAL', `${fmt2(totGallons)} gal`, `S/ ${fmt2(totGross)}`],
      ];
      drawTableFull('RESUMEN GLOBAL', [['Concepto', 'Galones', 'Total']], summaryBody);

      // CUADRO A ENTREGAR
      const montoAEntregar = Number((montoInicial + efectivoVendido - enCaja).toFixed(2));
      (autoTable as any)(doc, { ...tableBase(),
        head: [['Concepto', 'Monto']],
        body: [
          ['Monto inicial', `S/ ${fmt2(montoInicial)}`],
          ['Efectivo vendido', `S/ ${fmt2(efectivoVendido)}`],
          ['En caja', `- S/ ${fmt2(enCaja)}`],
          [{ content: 'TOTAL A ENTREGAR', styles: { fontStyle: 'bold' } },
           { content: `S/ ${fmt2(montoAEntregar)}`, styles: { fontStyle: 'bold' } }],
        ],
        startY: Math.max(MY + 44, (doc as any).lastAutoTable?.finalY ?? MY + 44),
        columnStyles: { 1: { halign: 'right' } },
      });

      // Paginación
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(9); doc.setTextColor('#64748b');
        doc.text(`Página ${i} de ${pageCount}`, pageW - 44, pageH - 16, { align: 'right' });
      }

      const safeDate = (dayLabel ?? '').replace(/\//g, '-') || new Date().toISOString().slice(0, 10);
      doc.save(`reporte-turno-${(shift ?? '').replace(/\s+/g, '_')}-${safeDate}.pdf`);
    } catch (e) {
      console.error('Error generando PDF:', e);
      alert('No se pudo generar el PDF. Revisa la consola para detalles.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleGeneratePdf}
      disabled={downloading}
      className={className ?? 'rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60'}
      title={title ?? 'Descargar PDF unificado (cabecera + medidores + ventas)'}
    >
      {downloading ? 'Generando…' : (children ?? 'Generar reporte')}
    </button>
  );
};

export default GenerarReporteButton;
