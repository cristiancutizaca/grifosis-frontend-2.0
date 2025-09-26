'use client';
import { useCallback, useState } from 'react';
import saleService from './../../../src/services/saleService';
import nozzleService from './../../../src/services/nozzleService';
import { asArray } from './../../../src/utils/arrays';
import { fmtTime, fmtDateTime } from './../../../src/utils/dates';
import { IGV_BY_FUEL, type FuelType } from './../../../src/constants/fuels';
import { parseGrossFromNotes } from './../../../src/utils/sales';
import { getPaymentLabel } from './../../../src/constants/payments';
import type { PumpInfo, Client } from './use-lists';

interface Product { id: number; nombre: FuelType; precio: number; tipo: string; }

export const useRecentSales = (
  products: Product[],
  pumpList: PumpInfo[],
  clientById: Map<number, Client>
) => {
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loadingRecentSales, setLoadingRecentSales] = useState(false);

  const refreshRecentSales = useCallback(async () => {
    setLoadingRecentSales(true);
    try {
      const [salesRaw, allNozzlesRaw] = await Promise.all([
        saleService.getRecentSales(25),
        nozzleService.getAllNozzles()
      ]);
      const sales: any[] = asArray<any>(salesRaw);
      const allNozzles: any[] = asArray<any>(allNozzlesRaw);

      const nozzleMap = new Map<number, { pump_id?: number; product_name?: string; unit_price?: number }>();
      for (const n of allNozzles) {
        const nid = Number(n?.nozzle_id ?? n?.id);
        const pump_id = Number(n?.pump_id ?? n?.pump?.pump_id);
        const product_name = String(n?.product?.name ?? n?.producto?.nombre ?? '') || undefined;
        const unit_price = Number(n?.product?.unit_price ?? n?.producto?.precio ?? NaN);
        nozzleMap.set(nid, { pump_id, product_name, unit_price: Number.isFinite(unit_price) && unit_price > 0 ? unit_price : undefined });
      }

      const priceByFuel: Record<string, number> = {
        Diesel:  products.find((p) => p.nombre === 'Diesel')?.precio  ?? 0,
        Premium: products.find((p) => p.nombre === 'Premium')?.precio ?? 0,
        Regular: products.find((p) => p.nombre === 'Regular')?.precio ?? 0,
      };
      const pumpNameById = new Map(pumpList.map((p) => [p.pump_id, p.pump_name]));

      const enriched = sales.map((s: any) => {
        const nz = nozzleMap.get(Number(s.nozzle_id));
        const productName = nz?.product_name ?? '—';
        const pumpName = pumpNameById.get(nz?.pump_id ?? -1) ?? (nz?.pump_id ? `Surtidor ${nz.pump_id}` : 'Surtidor —');
        const unitPrice = nz?.unit_price ?? (productName ? priceByFuel[productName] ?? 0 : 0);

        const net = Number(s.final_amount ?? s.total_amount ?? 0);
        const rate = IGV_BY_FUEL[productName as keyof typeof IGV_BY_FUEL] ?? 0.18;
        let gross = parseGrossFromNotes(s?.notes ?? '');
        if (gross == null) gross = net > 0 ? net * (1 + rate) : 0;

        const volume = Number(s.volume_gallons ?? s.quantity_gallons ?? NaN);
        const gallons = Number.isFinite(volume) && volume > 0 ? volume : (unitPrice > 0 ? net / unitPrice : null);

        let uiClientName: string | undefined =
          s?.client?.name || [s?.client?.first_name, s?.client?.last_name].filter(Boolean).join(' ') || s?.client_name;
        if (!uiClientName && s?.client_id) {
          const c = clientById.get(Number(s.client_id));
          if (c) uiClientName = [c.nombre, c.apellido].filter(Boolean).join(' ') || (c as any).email || `Cliente ${c.id}`;
        }

        const discountAmount = Number(s.discount_amount ?? 0) || 0;
        const paymentLabel = getPaymentLabel(s);

        return {
          ...s,
          _ui: {
            clientName: uiClientName ?? 'Sin cliente',
            productName,
            pumpName,
            gallons,
            amountGross: gross,
            amountNet: net,
            time: fmtTime(s.sale_timestamp),
            dateTime: fmtDateTime(s.sale_timestamp),
            discountAmount,
            discountText: discountAmount > 0 ? `Desc: S/ ${discountAmount.toFixed(2)}` : 'Sin descuento',
            paymentLabel,
          },
        };
      });

      setRecentSales(enriched);
    } catch (err) {
      console.error(err);
      setRecentSales([]);
    } finally {
      setLoadingRecentSales(false);
    }
  }, [products, pumpList, clientById]);

  return { recentSales, loadingRecentSales, refreshRecentSales, setRecentSales };
};
