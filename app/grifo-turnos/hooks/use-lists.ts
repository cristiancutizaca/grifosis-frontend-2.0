'use client';
import { useEffect, useMemo, useState } from 'react';
import clientService, { Client as BaseClient } from './../../../src/services/clientService';
import pumpService from './../../../src/services/pumpService';
import { mapClient } from './../../../src/utils/clients';
import { getPumpNumericOrder } from './../../../src/utils/pumps';

export interface PumpInfo { pump_id: number; pump_name: string; nozzles: any[]; }
export interface Client extends BaseClient { id: number; }
type PumpData = { pump_id?: number; id?: number; pump_name?: string; pump_number?: string; nombre?: string; nozzles?: any[]; };

export const useLists = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const clientById = useMemo(() => {
    const m = new Map<number, Client>();
    clients.forEach((c) => m.set(Number(c.id), c));
    return m;
  }, [clients]);

  const [pumpList, setPumpList] = useState<PumpInfo[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [clientsData, pumpsDataRaw] = await Promise.all([
          clientService.getAllClients(),
          pumpService.getAllPumps()
        ]);

        const mappedClients = clientsData.map(mapClient);
        setClients(mappedClients);

        const pumpsArr = Array.isArray(pumpsDataRaw) ? (pumpsDataRaw as any[]) : [];
        pumpsArr.sort((a, b) => getPumpNumericOrder(a) - getPumpNumericOrder(b));
        const pumpObjects: PumpInfo[] = pumpsArr.map((p: PumpData, idx) => {
          const id = Number(p?.pump_id ?? p?.id ?? idx + 1);
          const num = getPumpNumericOrder(p);
          const name = String(p?.pump_name ?? p?.nombre ?? p?.pump_number ?? `Surtidor ${String(num).padStart(3, '0')}`);
          return { pump_id: id, pump_name: name, nozzles: [] };
        });
        setPumpList(pumpObjects);
      } catch (err) {
        console.error('Error inicial (clientes/surtidores):', err);
      }
    })();
  }, []);

  return { clients, clientById, pumpList };
};
