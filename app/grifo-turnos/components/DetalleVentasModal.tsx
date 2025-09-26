'use client';

import React from 'react';
import { X, Fuel } from 'lucide-react';
import cashBoxService from './../../../src/services/cashBoxService';

/* ✅ NUEVOS IMPORTS SOLO PARA MEDIDORES */
import MeterReadingService from '../../../src/services/meterReadingService';
import NozzleService from '../../../src/services/nozzleService';
import PumpService from '../../../src/services/pumpService';
import ProductService from '../../../src/services/productService';

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

  /** Montos digitados en UI (fallbacks) */
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
  const [downloading, setDownloading] = React.useState(false);

  if (!open) return null;

  const fmt2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');
  const capWords = (s?: string) =>
    (s ?? '')
      .split(' ')
      .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');

  /* ================== UTILIDADES ================== */

  const parseMoneySmart = (input: string): number => {
    let t = String(input ?? '');
    t = t.replace(/[^0-9.,-]/g, '');
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
      const decSep = lastComma > lastDot ? ',' : '.';
      const thouSep = decSep === ',' ? '.' : ',';
      t = t.split(thouSep).join('');
      t = t.replace(decSep, '.');
    } else if (lastComma !== -1) {
      t = t.replace(/,/g, '.');
    }
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : NaN;
  };

  const normalizeShift = (s: any): 'Leon' | 'Lobo' | 'Buho' => {
    const clean = String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim().toLowerCase();
    if (clean.startsWith('leo') || clean.includes('man') || clean.includes('mañ')) return 'Leon';
    if (clean.startsWith('lob') || clean.includes('tar')) return 'Lobo';
    return 'Buho';
  };

  const dbShiftKey = (s: string) => normalizeShift(s);

  const tsNum = (e?: any) => {
    const raw =
      e?.timestamp ||
      e?.created_at ||
      e?.createdAt ||
      e?.closed_at ||
      e?.opened_at ||
      e?.time ||
      e?.date ||
      '';
    const s = String(raw);
    const iso = s.includes('T') ? s : s.replace(' ', 'T');
    const d = new Date(iso);
    const t = d.getTime();
    return Number.isFinite(t) ? t : -Infinity;
  };

  const dateKeyFromLabel = (): string => {
    if (dayLabel) {
      const str = String(dayLabel).trim();
      let m = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      m = str.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
      if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
    return new Date()
      .toLocaleString('sv-SE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' })
      .slice(0, 10);
  };

  /* ========== LECTURAS DESDE HISTORIAL / FORMULARIO (fallbacks) ========== */

  const readInputNextToLabel = (labelRegex: RegExp): number => {
    const labels = Array.from(document.querySelectorAll<HTMLElement>('label,div,p,span,strong'))
      .filter(el => labelRegex.test((el.textContent || '').trim()));
    for (const lab of labels) {
      if (lab.tagName.toLowerCase() === 'label') {
        const id = lab.getAttribute('for');
        if (id) {
          const target = document.getElementById(id) as HTMLInputElement | null;
          const v = target ? parseMoneySmart(target.value || '') : NaN;
          if (Number.isFinite(v)) return v;
        }
      }
      let sib: HTMLElement | null = lab.nextElementSibling as any;
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

  const readCashFromInputs = (): number => {
    const v1 = readInputNextToLabel(/^\s*en\s*caja\s*$/i);
    if (Number.isFinite(v1)) return v1;
    const v2 = readInputNextToLabel(/en\s*caja/i);
    if (Number.isFinite(v2)) return v2;
    const byPlaceholder = document.querySelector<HTMLInputElement>('input[placeholder*="En caja" i]');
    if (byPlaceholder) {
      const v = parseMoneySmart(byPlaceholder.value || '');
      if (Number.isFinite(v)) return v;
    }
    return NaN;
  };

  const fetchOpeningAmountFromDB = async (fallback?: number): Promise<number> => {
    try {
      const dateKey = dateKeyFromLabel();
      const day = await cashBoxService.historyDay(dateKey);
      const wanted = dbShiftKey(shift);

      const events: any[] = Array.isArray((day as any)?.events) ? (day as any).events : [];
      const opensThisShift = events.filter(
        (e: any) =>
          String(e?.type || '').toLowerCase() === 'open' &&
          normalizeShift(e?.shift || e?.shift_name || e?.turno) === wanted
      );

      const ev =
        opensThisShift.length > 0
          ? opensThisShift.sort((a, b) => tsNum(a) - tsNum(b)).at(-1)
          : null;

      const val = Number(ev?.amount ?? ev?.opening_amount);
      if (Number.isFinite(val)) return val;
    } catch {}
    if (Number.isFinite(Number(fallback))) return Number(fallback);
    return readOpeningFromPage() ?? 0;
  };

  const readCashFromHistory = (): number => {
    try {
      const wantedShift = dbShiftKey(shift);
      const all = Array.from(
        document.querySelectorAll<HTMLElement>('div,li,article,section,td,tr,p,span')
      );
      for (let i = all.length - 1; i >= 0; i--) {
        const el = all[i];
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!/cierre/i.test(txt)) continue;
        if (
          !(
            new RegExp(wantedShift, 'i').test(txt) ||
            (wantedShift === 'Lobo' && /tarde/i.test(txt)) ||
            (wantedShift === 'Leon' && /(mañ|man)/i.test(txt)) ||
            (wantedShift === 'Buho' && /(noche|buho|búho)/i.test(txt))
          )
        )
          continue;
        const m =
          txt.match(/(total\s*)?en\s*caja[^0-9]*([0-9][0-9.,]*)/i) ||
          txt.match(/\ben\s*caja\b[^0-9]*([0-9][0-9.,]*)/i);
        if (m) {
          const num = parseMoneySmart(m[2] ?? m[1]);
          if (Number.isFinite(num)) return num;
        }
      }
    } catch {}
    return NaN;
  };

  const readOpeningFromPage = (): number => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,div,span,p,td,th'));
    const labels = nodes.filter(el => /monto\s*inicial/i.test(el.textContent || ''));
    for (const lab of labels) {
      const tryParse = (t: string) => parseMoneySmart(t);
      let val = tryParse(lab.textContent || '');
      if (Number.isFinite(val)) return val;
      let sib: HTMLElement | null = lab.nextElementSibling as any;
      for (let i = 0; i < 3 && sib; i++) {
        val = tryParse(sib.textContent || '');
        if (Number.isFinite(val)) return val;
        sib = sib.nextElementSibling as any;
      }
      const cont = lab.closest('div') || lab.parentElement;
      if (cont) {
        const texts = Array.from(cont.querySelectorAll<HTMLElement>('*')).map(n => n.textContent || '');
        for (const t of texts) {
          val = tryParse(t);
          if (Number.isFinite(val)) return val;
        }
      }
    }
    return 0;
  };

  const getCashOnHand = (): number => {
    const fromInputs = readCashFromInputs();
    if (Number.isFinite(fromInputs) && fromInputs >= 0) return fromInputs;

    const fromHist = readCashFromHistory();
    if (Number.isFinite(fromHist) && fromHist >= 0) return fromHist;

    return 0;
  };

  const checkShiftClosedNow = async (): Promise<boolean> => {
    try {
      const dateKey = dateKeyFromLabel();
      const day = await cashBoxService.historyDay(dateKey);
      const wanted = dbShiftKey(shift);
      const events: any[] = Array.isArray((day as any)?.events) ? (day as any).events : [];

      const byShift = events.filter(
        (e: any) => normalizeShift(e?.shift || e?.shift_name || e?.turno) === wanted
      );

      const lastOpenTs = Math.max(
        ...byShift
          .filter(e => String(e?.type || '').toLowerCase() === 'open')
          .map(e => tsNum(e)),
        -Infinity
      );
      const lastCloseTs = Math.max(
        ...byShift
          .filter(e => String(e?.type || '').toLowerCase() === 'close')
          .map(e => tsNum(e)),
        -Infinity
      );

      return Number.isFinite(lastCloseTs) && lastCloseTs >= lastOpenTs && lastCloseTs !== -Infinity;
    } catch {
      return false;
    }
  };

  /* ================== PDF ================== */
  const handleGeneratePdf = async () => {
    const closed = await checkShiftClosedNow();
    if (!closed) {
      alert('Primero cierra la caja para poder generar el reporte.');
      return;
    }

    try {
      setDownloading(true);
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default as any;

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const MX = 44;
      const MY = 52;
      const COL_GAP = 14;
      const colW = (pageW - MX - MX - COL_GAP) / 2;

      const LINE_THIN = 0.2;
      const CELL_VPAD = 2;
      const dark = '#0B1220';
      const soft = '#334155';
      const money = (n: number) => `S/ ${fmt2(n)}`;

      const efectivoMethod = (methodDetails || []).find(m => /(efectivo|cash|contado)/i.test(m?.label || ''));
      const efectivoVendido = Number(efectivoMethod?.totalGross ?? 0);
      const enCaja = Number.isFinite(Number(cashOnHand)) ? Number(cashOnHand) : getCashOnHand();
      const montoInicial = await fetchOpeningAmountFromDB(openingAmount);

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('GRIFO — Reporte de ventas por producto', MX, MY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const ts = new Date().toLocaleString('es-PE');
      doc.text(`Turno: ${shift}    Fecha: ${dayLabel ?? ''}    Generado: ${ts}`, MX, MY + 14);

      doc.setDrawColor(soft);
      doc.setLineWidth(LINE_THIN);
      doc.line(MX, MY + 22, pageW - MX, MY + 22);

      const ensureSpace = (yTarget: number, estimatedHeight = 120) => {
        const bottomSafe = pageH - 90;
        if (yTarget + estimatedHeight > bottomSafe) {
          doc.addPage();
          return MY;
        }
        return yTarget;
      };
      const drawSectionTitle = (text: string, x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(text, x, y);
        return y + 8;
      };
      const drawTableTitle = (text: string, x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(text, x, y);
        return y + 8;
      };
      const baseTableOpts = (leftX: number, width: number) => ({
        headStyles: {
          fillColor: dark, textColor: '#ffffff', fontStyle: 'bold' as const, fontSize: 8,
          lineWidth: LINE_THIN, lineColor: '#d1d5db',
        },
        styles: {
          fontSize: 8.5,
          cellPadding: { top: CELL_VPAD, bottom: CELL_VPAD, left: 5, right: 5 },
          minCellHeight: 11, lineWidth: LINE_THIN, lineColor: '#d1d5db',
          halign: 'left' as const, valign: 'middle' as const,
        },
        footStyles: {
          fillColor: '#1e293b', textColor: '#ffffff', fontStyle: 'bold' as const, fontSize: 8.5,
          lineWidth: LINE_THIN, lineColor: '#d1d5db',
        },
        alternateRowStyles: { fillColor: '#f8fafc' },
        margin: { left: leftX, right: pageW - leftX - width },
        tableWidth: width, theme: 'grid' as const,
      });

      let yLeft = MY + 44;
      let yRight = MY + 44;

      const drawTableCol = (
        side: 'left' | 'right',
        title: string,
        head: any[][],
        body: any[][],
        foot?: any[][]
      ) => {
        const x = side === 'left' ? MX : MX + colW + COL_GAP;
        let y = side === 'left' ? yLeft : yRight;
        y = ensureSpace(y);
        y = drawTableTitle(title, x, y);

        autoTable(doc, {
          ...baseTableOpts(x, colW),
          startY: y,
          head, body, foot,
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });

        const fin = (doc as any).lastAutoTable.finalY + 20;
        if (side === 'left') yLeft = fin; else yRight = fin;
      };

      const drawTableFull = (title: string, head: any[][], body: any[][], foot?: any[][]) => {
        let y = Math.max(yLeft, yRight);
        y = ensureSpace(y, 160);
        y = drawSectionTitle(title, MX, y);

        autoTable(doc, {
          ...baseTableOpts(MX, pageW - MX - MX),
          startY: y,
          head, body, foot,
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });

        const fin = (doc as any).lastAutoTable.finalY + 20;
        yLeft = fin; yRight = fin;
      };

      const bodyNoCredit = (rows.length ? rows : [{ fuel: '—', gallons: 0, gross: 0 }]).map(r => [
        capWords(r.fuel || '—'), `${fmt2(r.gallons)} gal`, `S/ ${fmt2(r.gross)}`,
      ]);
      drawTableCol('left', 'Ventas cobradas (sin crédito)', [['Producto', 'Galones', 'Total']], bodyNoCredit, [
        ['Totales', `${fmt2(totalGallons)} gal`, `S/ ${fmt2(totalGross)}`],
      ]);

      const hasCredit = (creditRows?.length ?? 0) > 0 || (creditTotalGross ?? 0) > 0;
      const bodyCredit = (creditRows ?? []).map(r => [
        capWords(r.fuel || '—'), `${fmt2(r.gallons)} gal`, `S/ ${fmt2(r.gross)}`,
      ]);
      drawTableCol(
        'right',
        'Ventas en CRÉDITO',
        [['Producto', 'Galones', 'Total']],
        hasCredit ? bodyCredit : [['—', '0.00 gal', `S/ ${fmt2(0)}`]],
        [['Totales', `${fmt2(creditTotalGallons)} gal`, `S/ ${fmt2(creditTotalGross)}`]]
      );

      const filteredMethods = (methodDetails || []).filter(
        m => !/(cr[eé]dito|credit|efectivo|cash|contado)/i.test(m?.label ?? '')
      );

      if (creditClients.length > 0) {
        const body = creditClients.map(c => [
          c.client || '—',
          capWords(c.fuel || '—'),
          (c.gallons ?? 0) > 0 ? `${fmt2(c.gallons!)} gal` : '—',
          `S/ ${fmt2(c.gross || 0)}`,
        ]);
        drawTableFull('DETALLE DE CRÉDITOS POR CLIENTE', [['Cliente', 'Producto', 'Galones', 'Monto (Total)']], body);
      }

      const totGallons = totalGallons + (creditTotalGallons ?? 0);
      const totGross = totalGross + (creditTotalGross ?? 0);
      const summaryBody: any[][] = [
        ['Contado', `${fmt2(totalGallons)} gal`, `S/ ${fmt2(totalGross)}`],
        ['Crédito', `${fmt2(creditTotalGallons)} gal`, `S/ ${fmt2(creditTotalGross)}`],
        ...filteredMethods.map(m => [capWords(m.label || '—'), `${fmt2(m.totalGallons)} gal`, `S/ ${fmt2(m.totalGross)}`]),
        ['TOTAL', `${fmt2(totGallons)} gal`, `S/ ${fmt2(totGross)}`],
      ];
      drawTableFull('RESUMEN GLOBAL', [['Concepto', 'Galones', 'Total']], summaryBody);

      const efectivoMethod2 = (methodDetails || []).find(m => /(efectivo|cash|contado)/i.test(m?.label || ''));
      const efectivoVendido2 = Number(efectivoMethod2?.totalGross ?? 0);
      const enCaja2 = Number.isFinite(Number(cashOnHand)) ? Number(cashOnHand) : getCashOnHand();
      const montoInicial2 = await fetchOpeningAmountFromDB(openingAmount);
      const montoAEntregar = Number((montoInicial2 + efectivoVendido2 - enCaja2).toFixed(2));

      autoTable(doc, {
        head: [['Concepto', 'Monto']],
        body: [
          ['Monto inicial', `S/ ${fmt2(montoInicial2)}`],
          ['Efectivo vendido', `S/ ${fmt2(efectivoVendido2)}`],
          ['En caja', `- S/ ${fmt2(enCaja2)}`],
          [
            { content: 'TOTAL A ENTREGAR', styles: { fontStyle: 'bold' } },
            { content: `S/ ${fmt2(montoAEntregar)}`, styles: { fontStyle: 'bold' } },
          ],
        ],
        startY: Math.max(MY + 44, (doc as any).lastAutoTable?.finalY ?? MY + 44),
        styles: { fontSize: 8.5, cellPadding: 4 },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: 44, right: 44 },
        theme: 'grid',
      });

      const pageW2 = doc.internal.pageSize.getWidth();
      const pageH2 = doc.internal.pageSize.getHeight();
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor('#64748b');
        doc.text(`Página ${i} de ${pageCount}`, pageW2 - 44, pageH2 - 16, { align: 'right' });
      }

      const safeDate = (dayLabel ?? '').replace(/\//g, '-') || new Date().toISOString().slice(0, 10);
      doc.save(`reporte-turno-${shift}-${safeDate}.pdf`);
    } catch (e) {
      console.error('Error generando PDF:', e);
      alert('No se pudo generar el PDF. Revisa la consola para detalles.');
    } finally {
      setDownloading(false);
    }
  };

  /* ========= NUEVO: PDF de MEDIDORES (1 surtidor por fila, apaisado, compacto) ========= */
  const handleGenerarReporteMedidoresPdf = async () => {
    try {
      setDownloading(true);

      const dateYmd = dateKeyFromLabel();

      // intervalo OPEN → CLOSE del mismo turno
      const wantedShift = dbShiftKey(shift);
      const day = await cashBoxService.historyDay(dateYmd);
      const events: any[] = Array.isArray((day as any)?.events) ? (day as any).events : [];

      const sameShift = events.filter(
        (e: any) => normalizeShift(e?.shift || e?.shift_name || e?.turno) === wantedShift
      );

      const tsOf = (raw: any) => {
        const s = String(
          raw?.timestamp || raw?.created_at || raw?.createdAt ||
          raw?.closed_at || raw?.opened_at || raw?.date || ''
        );
        if (!s) return -Infinity;
        const iso = s.includes('T') ? s : s.replace(' ', 'T');
        const t = new Date(iso).getTime();
        return Number.isFinite(t) ? t : -Infinity;
      };

      const opens  = sameShift.filter(e => String(e?.type || '').toLowerCase() === 'open' ).sort((a,b)=>tsOf(a)-tsOf(b));
      const closes = sameShift.filter(e => String(e?.type || '').toLowerCase() === 'close').sort((a,b)=>tsOf(a)-tsOf(b));

      const lastOpen        = opens.at(-1) || null;
      const tOpen           = tsOf(lastOpen);
      const firstCloseAfter = closes.find(c => tsOf(c) >= tOpen) || null;
      const tClose          = tsOf(firstCloseAfter);

      if (!(Number.isFinite(tOpen) && Number.isFinite(tClose) && tClose >= tOpen)) {
        alert('No se encontró un intervalo válido de apertura/cierre para este turno.');
        return;
      }

      // lecturas + catálogos
      const [shiftReadings, nozzles, pumps, products] = await Promise.all([
        MeterReadingService.getShiftReadings(dateYmd),
        NozzleService.getAllNozzles(),
        PumpService.getAllPumps(),
        ProductService.getAllProducts(),
      ]);

      const nozzleById = new Map((nozzles || []).map((n: any) => [n.nozzle_id, n]));
      const pumpById   = new Map((pumps || []).map((p: any) => [p.pump_id, p]));
      const prodById = new Map(
        (products || []).map((p: any) => {
          const pid = p?.product_id ?? p?.id ?? p?.productId;   // acepta varias variantes
          return [pid, p];
        })
      );
      // helper para timeline seguro
      const getTimeline = (r: any): any[] => {
        if (Array.isArray(r?.readings)) return r.readings;
        if (Array.isArray(r?.timeline)) return r.timeline;
        if (Array.isArray(r?.entries))  return r.entries;
        return [];
      };
      const pickOpen = (arr: any[]) => {
        const c = (arr || []).filter(x => Number.isFinite(tsOf(x)) && tsOf(x) >= tOpen);
        return c.length ? c.sort((a,b)=>tsOf(a)-tsOf(b))[0] : null;
      };
      const pickClose = (arr: any[]) => {
        const c = (arr || []).filter(x => Number.isFinite(tsOf(x)) && tsOf(x) <= tClose);
        return c.length ? c.sort((a,b)=>tsOf(a)-tsOf(b)).at(-1) : null;
      };

      type CardRow = {
        product: string;
        nozzle: string | number;
        open?: number;
        close?: number;
        diff?: number;
        unit?: string;
      };

      // agrupar por SURTIDOR
      const byPump: Record<string, CardRow[]> = {};
      for (const rr of (shiftReadings as any[] || [])) {
        const r: any = rr;
        const noz  = nozzleById.get(r.nozzle_id);
        const pump = noz ? pumpById.get(noz.pump_id) : null;
        const prod = noz ? prodById.get(noz.product_id) : null;

        const pumpName = pump?.pump_name ?? 'Surtidor —';
        const timeline = getTimeline(r);

        let op: any = null, cl: any = null;
        if (timeline.length) {
          op = pickOpen(timeline);
          cl = pickClose(timeline);
        }
        const fr = r.firstReading, lr = r.lastReading;
        if (!op && fr && Number.isFinite(tsOf(fr)) && tsOf(fr) >= tOpen && tsOf(fr) <= tClose) op = fr;
        if (!cl && lr && Number.isFinite(tsOf(lr)) && tsOf(lr) >= tOpen && tsOf(lr) <= tClose) cl = lr;

        const opening = op ? Number(op.initial_reading ?? op.reading ?? op.value) : NaN;
        const closing = cl ? Number(cl.final_reading   ?? cl.reading ?? cl.value) : NaN;
        const diff    = (Number.isFinite(opening) && Number.isFinite(closing)) ? (closing - opening) : NaN;

        const row: CardRow = {
          product: (
                    prod?.product_name ??
                    prod?.name ??
                    prod?.product ??
                    prod?.description ??
                    '—'
                  ),
          nozzle: noz?.nozzle_number ?? '—',
          open: Number.isFinite(opening) ? opening : undefined,
          close: Number.isFinite(closing) ? closing : undefined,
          diff: Number.isFinite(diff) ? diff : undefined,
          unit: 'gal',
        };

        if (!byPump[pumpName]) byPump[pumpName] = [];
        byPump[pumpName].push(row);
      }

      // === PDF TARJETAS: A4 landscape, 1 tarjeta por fila, compacto ===
      const { default: jsPDF } = await import('jspdf');
      const autoTableMod: any = await import('jspdf-autotable');
      const autoTable = autoTableMod.default || autoTableMod;

      const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });

      const MX = 44, MY = 48;
      const GAPY = 8;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Cabecera compacta
      doc.setFont('helvetica','bold'); doc.setFontSize(16);
      doc.text('Reporte de Medidores', MX, MY);
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      const fmtTs = (t:number) => new Date(t).toLocaleString('es-PE', { hour12:false });
      doc.text(
        `Fecha: ${dayLabel ?? dateYmd}   Turno: ${shift}   Apertura: ${fmtTs(tOpen)}   Cierre: ${fmtTs(tClose)}`,
        MX, MY + 18
      );

      // Layout 1 tarjeta por fila
      const pumpNames = Object.keys(byPump).sort();
      const cardW = pageW - MX - MX;
      const innerPad = 10;

      let curX = MX;
      let curY = MY + 36;

      const newPage = () => {
        doc.addPage();
        curX = MX;
        curY = MY;
        doc.setFont('helvetica','bold'); doc.setFontSize(12);
        doc.text(`Medidores · ${dayLabel ?? dateYmd} · ${shift}`, MX, curY);
        curY += 12;
      };

      for (const pumpName of pumpNames) {
        const rows = byPump[pumpName] || [];

        // Título de tarjeta
        doc.setFont('helvetica','bold');
        doc.setFontSize(12);
        doc.text(pumpName, curX + innerPad, curY + 16);

        // Tabla: Producto flexible con wrap; números a la derecha
        const head = [['Producto', 'Boq.', 'Apertura (gal)', 'Cierre (gal)', 'Dif. (gal)']];
        const body = rows.map(r => [
          String(r.product ?? '—'),
          String(r.nozzle ?? '—'),
          r.open  != null ? r.open.toFixed(3)  : '',
          r.close != null ? r.close.toFixed(3) : '',
          r.diff  != null ? r.diff.toFixed(3)  : '',
        ]);

        // anchos fijos para números y boquilla; el resto para "Producto"
        const wNoz = 56;
        const wNum = 88;
        const wProduct = Math.max(160, (cardW - innerPad * 2) - (wNoz + wNum * 3));

        autoTable(doc, {
          head, body,
          startY: curY + 20,
          margin: { left: curX + innerPad, right: pageW - (curX + cardW) + innerPad },
          tableWidth: cardW - innerPad * 2,

          styles: {
            font: 'helvetica',
            fontSize: 9.5,
            cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
            minCellHeight: 11,
            lineWidth: 0.2,
            lineColor: [210, 214, 220],
            overflow: 'linebreak',
            valign: 'middle',
          },
          headStyles: {
            fillColor: [18, 26, 40],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9.5,
            lineWidth: 0.2,
            lineColor: [210, 214, 220],
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          theme: 'grid',

          columnStyles: {
            0: { cellWidth: wProduct, halign: 'left' }, // Producto
            1: { cellWidth: wNoz,    halign: 'center' },// Boq.
            2: { cellWidth: wNum,    halign: 'right' }, // Apertura
            3: { cellWidth: wNum,    halign: 'right' }, // Cierre
            4: { cellWidth: wNum,    halign: 'right' }, // Dif.
          },

          rowPageBreak: 'avoid',

          // baja un poco la fuente SOLO si el nombre es muy largo
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 0) {
              const txt = String((data.cell.text || []).join(''));
              if (txt.length > 36) data.cell.styles.fontSize = 9;
              if (txt.length > 54) data.cell.styles.fontSize = 8.5;
              if (txt.length > 72) data.cell.styles.fontSize = 8;
            }
          },
        });

        // cerrar tarjeta ajustando al contenido
        const tableEndY = (doc as any).lastAutoTable.finalY;
        const yBottom   = tableEndY + innerPad;

        doc.setDrawColor(205);
        doc.roundedRect(curX, curY, cardW, yBottom - curY, 5, 5);

        // avanzar debajo de la tarjeta
        curY = yBottom + GAPY;

        // salto de página si no cabe la próxima tarjeta
        const estimatedHeight = 28 + (rows.length + 1) * 16 + 18;
        if (curY + estimatedHeight > pageH - MY) newPage();
      }

      // Footer de paginación
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor('#64748b');
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        doc.text(`Página ${i} de ${pages}`, w - MX, h - 14, { align: 'right' });
      }

      const filename = `medidores_${(dayLabel ?? dateYmd).replace(/\//g,'-')}_${String(shift).replace(/\s+/g,'_')}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error('PDF medidores error:', e);
      alert('No se pudo generar el PDF de medidores.');
    } finally {
      setDownloading(false);
    }
  };
  /* ================== FIN CAMBIO ================== */

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
    <div className="fixed inset-0 z:[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="
          relative z-[101] w-full max-w-3xl md:max-w-4xl
          rounded-2xl border border-white/10 bg-[#0F172A]
          shadow-[0_20px_60px_rgba(0,0,0,.55)]
          max-h-[85vh] flex flex-col
        "
      >
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
            className="rounded-md p-2 text-slate-300 hover:bg:white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <Table title="Ventas cobradas (sin crédito)" data={rows} gallonsTotal={totalGallons} grossTotal={totalGross} />
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
                    data={m.rows.map(r => ({ fuel: capWords(r.product), gallons: r.gallons, gross: r.gross }))}
                    gallonsTotal={m.totalGallons}
                    grossTotal={m.totalGross}
                  />
                ))}
            </div>
          )}

          {creditClients.length > 0 && (
            <div className="mt-1">
              <div className="mb-2 text-[13px] font-semibold text:white">Detalle de créditos por cliente</div>
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

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0F172A] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <button
              onClick={handleGeneratePdf}
              disabled={downloading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              title="Descargar PDF con el detalle de ventas de este turno"
            >
              {downloading ? 'Generando…' : 'Generar reporte'}
            </button>

            {/* ========= BOTÓN: MEDIDORES (PDF) ========= */}
            <button
              onClick={handleGenerarReporteMedidoresPdf}
              disabled={downloading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              title="Descargar PDF con lecturas de medidores (apertura/cierre) por surtidor, producto y boquilla"
            >
              {downloading ? 'Generando…' : 'Medidores (PDF)'}
            </button>
            {/* =============================================== */}
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
