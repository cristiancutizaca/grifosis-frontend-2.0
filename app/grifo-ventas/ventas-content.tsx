'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  CreditCard,
  DollarSign,
  Fuel,
  RefreshCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';

import saleService from '../../src/services/saleService';
import clientService, { Client as BaseClient } from '../../src/services/clientService';
import pumpService from '../../src/services/pumpService';
import nozzleService from '../../src/services/nozzleService';
import { Dispensador as Nozzle } from '../../app/grifo-inventario/types/dispensadores';
import paymentsService, { CreditPaymentItem } from '../../src/services/paymentsService'; // (ya estaba)
import { generarReciboPDF, type VentaParaRecibo } from './../../src/utils/recibos';
import NozzleSelectionModal from './components/NozzleSelectionModal';
// Config + Métodos de pago
import settingsService from '../../src/services/settingsService';
import paymentMethodService from '../../src/services/paymentMethodService';
// Colores por producto
import { getClassesForProduct } from '../../src/utils/productColors';
// Servicio de caja
import cashBoxService from '../../src/services/cashBoxService';
// Para consultar endpoints sin crear servicios nuevos
import apiService from '../../src/services/apiService';
// 2.1: Importa el servicio de conductores
import clientDriversService, { ClientDriver } from '../../src/services/clientDriversService';

/* ---------- HELPERS / CONST ---------- */
import { decodeUserIdFromJWT } from '../../src/utils/jwt';
import { fmtTime, fmtDateTime, toLocalDateInputValue } from '../../src/utils/dates';
import { asArray } from '../../src/utils/arrays';
import { cleanNotes } from '../../src/utils/text';
import { getPumpNumericOrder } from '../../src/utils/pumps';
import { IGV_BY_FUEL, toFuelType, type FuelType } from '../../src/constants/fuels';
import {
  PAYMENT_OPTIONS,
  getPaymentLabel,
  type PaymentKey,
} from '../../src/constants/payments';
import { mapClient } from '../../src/utils/clients';
import Modal from '../../src/components/Modal';

/* ====== NUEVO: helpers mínimos para encabezado de empresa en PDF ====== */
type EmpresaHeader = {
  nombre: string;
  ruc?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  logoBase64?: string; // base64 SIN prefijo data:
};

// Convierte URL de imagen a base64 (sin "data:image/...;base64,")
async function urlToBase64NoPrefix(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
        resolve(base64 || undefined);
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

// Lee desde settingsService (tu tabla "sentings") y arma el encabezado
async function fetchEmpresaFromSettings(): Promise<EmpresaHeader> {
  const s: any = await settingsService.getSettings().catch(() => null);

  const nombre    = s?.grifo_name        ?? s?.company_name    ?? s?.name        ?? s?.nombre ?? 'GRIFO';
  const ruc       = s?.ruc                ?? s?.company_ruc     ?? s?.ruc_number  ?? undefined;
  const direccion = s?.direccion          ?? s?.company_address ?? s?.address     ?? undefined;
  const telefono  = s?.telefono           ?? s?.company_phone   ?? s?.phone      ?? undefined;
  const email     = s?.email              ?? s?.company_email   ?? undefined;

  const base64Directo = s?.company_logo_base64 ?? s?.logo_base64 ?? undefined;
  const logoUrl       = s?.company_logo_url ?? s?.logo_url ?? s?.logo ?? undefined;

  let logoBase64 = base64Directo as string | undefined;
  if (!logoBase64 && logoUrl) {
    logoBase64 = await urlToBase64NoPrefix(String(logoUrl));
  }

  return { nombre, ruc, direccion, telefono, email, logoBase64 };
}
/* ====================================================================== */

/* ------------------------------ Tipos ------------------------------ */
interface PumpInfo { pump_id: number; pump_name: string; nozzles: any[]; }
interface Client extends BaseClient { id: number; }
type PumpData = { pump_id?: number; id?: number; pump_name?: string; pump_number?: string; nombre?: string; nozzles?: any[]; };
interface Product { id: number; nombre: string; precio: number; tipo: string; }
type PaymentOption = { key: PaymentKey; id: number; label: string };

/* ===== Descuentos de configuración ===== */
type ConfigDiscount = {
  id: number;
  name: string;
  gallons: number;   // mínimo de galones para habilitar
  amount: number;    // S/ por galón
  active: boolean;
  created_at?: string;
};

interface NozzleInGroup {
  nozzle_id: number;
  nozzle_number: number;
  estado?: string;
}

interface ProductGroup {
  producto: Product;
  boquillas: NozzleInGroup[];
}
/* ==================================================================== */


const STORAGE_FLAG = 'turno:caja:open-flag';

const GrifoNewSale: React.FC = () => {
  const [selectedFuel, setSelectedFuel] = useState<FuelType>('Premium');
  const [quantity, setQuantity] = useState<string>('');       // se calcula desde importe o se escribe en galones
  const [paymentMethod, setPaymentMethod] = useState<PaymentKey>('CASH');

  const [discount, setDiscount] = useState<string>('0');       // S/ total (se calcula)
  const [observations, setObservations] = useState<string>('');

  const [, setTaxRate] = useState<number>(0.18);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [subtotal, setSubtotal] = useState<number>(0);

  // Modo de entrada: S/ (AMOUNT) o Galones (GALLONS)
  const [entryMode, setEntryMode] = useState<'GALLONS' | 'AMOUNT'>('AMOUNT');
  const [manualAmount, setManualAmount] = useState<string>(''); // en AMOUNT = S/ ; en GALLONS = galones

  /** Cliente */
  const [showClientSearch, setShowClientSearch] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchingClients, setSearchingClients] = useState(false);
  const clientBoxRef = useRef<HTMLDivElement>(null);

  // 2.2: Estado para conductores (solo cuando el cliente seleccionado es empresa)
  const [drivers, setDrivers] = useState<ClientDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<ClientDriver | null>(null);
  const driverBoxRef = useRef<HTMLDivElement>(null);
  const isCompany = (c: any | null) => {
    const t = (c?.client_type ?? c?.tipo_cliente ?? '').toString().toLowerCase();
    return t === 'empresa';
  };

  // Productos / surtidores
  const [pumpNozzles, setPumpNozzles] = useState<any[]>([]);
  const [selectedPumpId, setSelectedPumpId] = useState<number | null>(null);
  const [pumpList, setPumpList] = useState<PumpInfo[]>([]);
  const [nozzleByProduct, setNozzleByProduct] = useState<Record<number, number>>({});
  const [currentPumpNozzles, setCurrentPumpNozzles] = useState<Nozzle[]>([]);
  const [selectedNozzleId, setSelectedNozzleId] = useState<number | null>(null);
  const [showNozzleModal, setShowNozzleModal] = useState(false);
  const [nozzlesForModal, setNozzlesForModal] = useState<NozzleInGroup[]>([]);
  
  // Tarjetas fusionadas tanque+boquilla
  const [mergedCards, setMergedCards] = useState<Array<{ nozzle_id: number | null; producto: Product; disabled?: boolean }>>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Productos
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Métodos de pago dinámicos
  const [availablePayments, setAvailablePayments] = useState<PaymentOption[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loadingRecentSales, setLoadingRecentSales] = useState(false);

  // Estado de caja
  const [cashOpen, setCashOpen] = useState<boolean | null>(null);
  const [cashMsg, setCashMsg] = useState<string>('');

  // ===== NUEVO: cache de encabezado de empresa para el PDF
  const [empresaInfo, setEmpresaInfo] = useState<EmpresaHeader | null>(null);
  
  // ===== NUEVO: descuentos de configuración
  const [discounts, setDiscounts] = useState<ConfigDiscount[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<number | null>(null);
  const [customDiscountRate, setCustomDiscountRate] = useState<number | null>(null);
  
  const RECENT_LIMIT = 25;

  /** Paginación local */
  const PAGE_SIZE = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(recentSales.length / PAGE_SIZE));
  const pageSales = useMemo(
    () => recentSales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [recentSales, currentPage]
  );

  const clientById = useMemo(() => {
    const m = new Map<number, Client>();
    clients.forEach((c) => m.set(Number(c.id), c));
    return m;
  }, [clients]);

  // 2.3: Filtro local de conductores
  const filteredDrivers = useMemo(() => {
    const term = (driverSearch || '').trim().toLowerCase();
    if (!term) return drivers.slice(0, 20);
    return drivers
      .filter(d => {
        const name = (d.full_name || '').toLowerCase();
        const dni = (d.dni || '').toLowerCase();
        const plate = (d.plate || '').toLowerCase();
        return name.includes(term) || dni.includes(term) || plate.includes(term);
      })
      .slice(0, 20);
  }, [drivers, driverSearch]);

  /** Crédito */
  const [isCredit, setIsCredit] = useState<boolean>(false);
  const [dueDate, setDueDate] = useState<string>('');
  const [creditModalOpen, setCreditModalOpen] = useState<boolean>(false);

  // === Nuevo: Modal de métodos de pago (solo UI)
  const [paymentsOpen, setPaymentsOpen] = useState<boolean>(false);

  // =============================== NUEVO: pestaña y listados de Pagos de crédito ===============================
  type RecentTab = 'ventas' | 'pagosCredito'; // NUEVO
  const [recentTab, setRecentTab] = useState<RecentTab>('ventas'); // NUEVO
  const CREDIT_PAGE_SIZE = 5; // NUEVO
  const [creditPays, setCreditPays] = useState<CreditPaymentItem[]>([]); // NUEVO
  const [creditPaysLoading, setCreditPaysLoading] = useState(false); // NUEVO
  const [creditPaysPage, setCreditPaysPage] = useState(1); // NUEVO
  const [creditPaysTotal, setCreditPaysTotal] = useState(0); // NUEVO

  const refreshCreditPayments = async () => { // NUEVO
    try {
      setCreditPaysLoading(true);
      const { items, total } = await paymentsService.getRecentCreditPayments(creditPaysPage, CREDIT_PAGE_SIZE);
      setCreditPays(items || []);
      setCreditPaysTotal(Number(total || 0));
    } catch (e: any) {
      setError(e?.message || 'Error cargando pagos de créditos');
      setCreditPays([]);
      setCreditPaysTotal(0);
    } finally {
      setCreditPaysLoading(false);
    }
  };

  useEffect(() => { // NUEVO: carga cuando se cambia a la pestaña de pagos de crédito o paginación
    if (recentTab !== 'pagosCredito') return;
    refreshCreditPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentTab, creditPaysPage]);

  const refreshing = recentTab === 'ventas' ? loadingRecentSales : creditPaysLoading; // NUEVO
  // =============================================================================================================

  /* --------------------------- utils productos --------------------------- */
  const mapProductRaw = (p: any): Product => ({
    id: Number(p?.id ?? p?.product_id),
    nombre: String(p?.name ?? p?.nombre ?? p?.fuel_type ?? 'Producto'),
    precio: Number(p?.unit_price ?? p?.precio ?? p?.price ?? 0),
    tipo: String(p?.category ?? p?.tipo ?? p?.fuel_type ?? ''),
  });

  const fetchProductsGlobal = async () => {
    try {
      // @ts-ignore
      const mod = await import('../../src/services/productService').catch(() => null);
      if (mod?.default || mod) {
        const svc: any = mod.default ?? mod;
        const raw = await svc.getAllProducts();
        const arr = asArray<any>(raw).map(mapProductRaw);
        const uniq = new Map<string, Product>();
        arr.forEach((x) => uniq.set(String(x.nombre).toLowerCase(), x));
        setProducts(Array.from(uniq.values()));
        return;
      }
    } catch { }
    try {
      const allNozzles = asArray<any>(await nozzleService.getAllNozzles());
      const uniq = new Map<string, Product>();
      for (const n of allNozzles) {
        const p = mapProductRaw(n?.product ?? n?.producto ?? {});
        if (p.id) uniq.set(String(p.nombre).toLowerCase(), p);
      }
      setProducts(Array.from(uniq.values()));
    } catch {
      setProducts([]);
    }
  };

  /* ---------------------- Métodos de pago (desde BD+Config) ---------------------- */
  const normalizePaymentKey = (v?: string): PaymentKey | null => {
    if (!v) return null;
    const s = String(v).trim().toUpperCase();
    const dict: Record<string, PaymentKey> = {
      CASH: 'CASH', EFECTIVO: 'CASH',
      CARD: 'CARD', TARJETA: 'CARD',
      TRANSFER: 'TRANSFER', TRANSFERENCIA: 'TRANSFER', 'TRANSFERENCIA BANCARIA': 'TRANSFER',
      CREDIT: 'CREDIT', CREDITO: 'CREDIT', 'CRÉDITO': 'CREDIT',
    };
    return dict[s] ?? null;
  };

  const PAYMENT_BY_NAME: Record<string, PaymentKey> = {
    efectivo: 'CASH',
    tarjeta: 'CARD',
    transferencia: 'TRANSFER',
    credito: 'CREDIT',
  };

  const normalizeName = (s?: string) =>
    (s ?? '')
      .normalize('NFD')
      // @ts-ignore unicode escapes
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();

  const fetchActivePaymentOptions = async () => {
    try {
      const settings = await settingsService.getSettings().catch(() => null);
      const allowedKeys = new Set<PaymentKey>();
      const allowedNames = new Set<string>();

      if (settings?.payment_methods) {
        String(settings.payment_methods)
          .split(',')
          .map(s => normalizeName(s))
          .filter(Boolean)
          .forEach(name => {
            const k = PAYMENT_BY_NAME[name];
            if (k) allowedKeys.add(k);
            allowedNames.add(name);
          });
      }

      const fromDb = await paymentMethodService.getAll();
      const activesDb = (fromDb || [])
        .filter((m: any) => m?.is_active === true)
        .map((m: any) => {
          const label = String(m?.method_name ?? '').trim();
          const knownKey = normalizePaymentKey(label);
          return {
            key: (knownKey ?? (`CUSTOM_${m?.payment_method_id}` as unknown as PaymentKey)),
            id: Number(m?.payment_method_id),
            label,
            _normName: normalizeName(label),
          } as PaymentOption & { _normName: string };
        });

      let finalList: PaymentOption[] = [];
      if (allowedKeys.size > 0 || allowedNames.size > 0) {
        finalList = activesDb
          .filter(op => allowedKeys.has(op.key) || allowedNames.has((op as any)._normName))
          .map(({ _normName, ...rest }) => rest);
      } else {
        finalList = activesDb.map(({ _normName, ...rest }) => rest);
      }

      if (!finalList.length) {
        const cash = PAYMENT_OPTIONS.find(p => p.key === 'CASH');
        finalList = cash ? [{ id: cash.id, key: cash.key, label: cash.label }] : [];
      }

      setAvailablePayments(finalList);
    } catch (e) {
      console.warn('Fallo obteniendo métodos de pago. Fallback a Efectivo:', e);
      const cash = PAYMENT_OPTIONS.find(p => p.key === 'CASH');
      setAvailablePayments(cash ? [{ id: cash.id, key: cash.key, label: cash.label }] : []);
    }
  };

  /* --------------------- Descuentos de configuración --------------------- */
  const mapDiscount = (d: any): ConfigDiscount => ({
    id: Number(d?.id ?? d?.discount_id ?? d?._id ?? Date.now()),
    name: String(d?.name ?? d?.nombre ?? 'Descuento'),
    gallons: Number(d?.gallons ?? d?.min_gallons ?? 0),
    amount: Number(d?.amount ?? d?.value ?? 0),
    active: Boolean(d?.active ?? d?.is_active ?? true),
    created_at: d?.created_at ?? undefined,
  });

  const fetchDiscountOptions = async () => {
    try {
      let list: any[] = [];
      // intentos típicos
      for (const path of ['/discounts', '/config/discounts', '/settings/discounts']) {
        try {
          const res = await apiService.get(path);
          list = asArray(res);
          if (list.length) break;
        } catch { /* noop */ }
      }
      if (!list.length) {
        const s: any = await settingsService.getSettings().catch(() => null);
        if (s?.discounts_json) {
          try { list = JSON.parse(s.discounts_json); } catch { list = []; }
        } else if (s?.discount_amount && s?.discount_gallons) {
          list = [{
            id: 1,
            name: 'DESCUENTO CONFIG',
            gallons: Number(s.discount_gallons),
            amount: Number(s.discount_amount),
            active: true,
          }];
        }
      }
      const mapped = asArray(list).map(mapDiscount).filter(d => d.active);
      setDiscounts(mapped);
    } catch {
      setDiscounts([]);
    }
  };

  /* --------------------------- Carga inicial --------------------------- */
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const userId = decodeUserIdFromJWT();
        setCurrentUserId(userId);

        const [clientsData, pumpsDataRaw] = await Promise.all([
          clientService.getAllClients(),
          pumpService.getAllPumps(),
        ]);

        const mappedClients = clientsData.map(mapClient);
        setClients(mappedClients);
        setFilteredClients(mappedClients.slice(0, 10));

        const pumpsArr = Array.isArray(pumpsDataRaw) ? (pumpsDataRaw as any[]) : [];
        pumpsArr.sort((a, b) => getPumpNumericOrder(a) - getPumpNumericOrder(b));

        const pumpObjects: PumpInfo[] = pumpsArr.map((p: PumpData, idx) => {
          const id = Number(p?.pump_id ?? p?.id ?? idx + 1);
          const num = getPumpNumericOrder(p);
          const name = String(
            p?.pump_name ?? p?.nombre ?? p?.pump_number ?? `Surtidor ${String(num).padStart(3, '0')}`
          );
            return { pump_id: id, pump_name: name, nozzles: [] };
        });

        setPumpList(pumpObjects);

        // ===== NUEVO: precargar encabezado de empresa para el PDF y descuentos
        fetchEmpresaFromSettings().then(setEmpresaInfo).catch(() => setEmpresaInfo(null));
        fetchDiscountOptions().catch(() => setDiscounts([]));

        await Promise.all([fetchProductsGlobal(), fetchActivePaymentOptions()]);
        if (pumpObjects.length > 0) await handlePumpSelect(pumpObjects[0].pump_id);
      } catch (err) {
        console.error(err);
        setError('Error al cargar los datos iniciales');
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  /** Auto-refresh de ventas, productos, métodos de pago y caja */
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
//const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
if (!token) { setRecentSales([]); return; }


    refreshRecentSales();
    fetchProductsGlobal();
    fetchActivePaymentOptions();
    checkCashBoxOpen();

    const interval = setInterval(() => {
      refreshRecentSales();
      fetchProductsGlobal();
      fetchActivePaymentOptions();
      checkCashBoxOpen();
    }, 15000);

    return () => clearInterval(interval);
  }, [clientById]);

  /** Ajusta página si cambia el total */
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  /** Asegura que el método seleccionado siga estando disponible */
  useEffect(() => {
    if (availablePayments.length === 0) return;
    const exists = availablePayments.some((p) => p.key === paymentMethod);
    if (!exists) {
      setPaymentMethod(availablePayments[0].key);
      setIsCredit(availablePayments[0].key === 'CREDIT');
    }
  }, [availablePayments]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3.1: Cargar conductores cuando el cliente empresa cambia
  useEffect(() => {
    // reset al cambiar cliente
    setSelectedDriver(null);
    setDriverSearch('');
    setDrivers([]);
    setShowDriverDropdown(false);

    if (!selectedClient || !isCompany(selectedClient)) return;

    (async () => {
      try {
        setDriversLoading(true);
        const list = await clientDriversService.list(Number(selectedClient.id));
        setDrivers(Array.isArray(list) ? list : []);
      } catch {
        setDrivers([]);
      } finally {
        setDriversLoading(false);
      }
    })();
  }, [selectedClient]);

  // 3.2: Cerrar dropdown de conductor con click fuera / Escape
  useEffect(() => {
    if (!showDriverDropdown) return;
    const onMouseDown = (e: MouseEvent) => {
      const box = driverBoxRef.current;
      if (box && !box.contains(e.target as Node)) setShowDriverDropdown(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowDriverDropdown(false); };
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showDriverDropdown]);

  /* ======================= Caja abierta? ======================= */
  const resolveShiftNames = (d = new Date()) => {
    const m = d.getHours() * 60 + d.getMinutes();
    let api: 'Leon' | 'Lobo' | 'Buho';
    let ui: 'León' | 'Lobo' | 'Búho';
    if (m >= 5 * 60 && m < 12 * 60) { api = 'Leon'; ui = 'León'; }
    else if (m >= 12 * 60 && m < 19 * 60) { api = 'Lobo'; ui = 'Lobo'; }
    else { api = 'Buho'; ui = 'Búho'; }
    return { api, ui };
  };
  const operationalDateYMD = (now = new Date(), apiShift: 'Leon' | 'Lobo' | 'Buho') => {
    const d = new Date(now);
    if (apiShift === 'Buho' && d.getHours() < 5) d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const checkCashBoxOpen = async () => {
    try {
      const { api, ui } = resolveShiftNames();
      const day = operationalDateYMD(new Date(), api);
      const res: any = await cashBoxService.getToday({ date: day, shift: api });

      const opened =
        !!res &&
        String(res.status || '').toLowerCase() === 'abierta' &&
        res.is_closed === false;

      setCashOpen(opened);
      setCashMsg(
        opened ? '' : `Caja no abierta para el turno "${ui}" (${day}). Ábrela en Turnos para habilitar Ventas.`
      );
    } catch (e) {
      console.warn('No se pudo verificar la caja:', e);
      setCashOpen(false);
      setCashMsg('Caja no abierta o sin respuesta del servidor.');
    }
  };

  useEffect(() => {
    checkCashBoxOpen();
  }, []);

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === STORAGE_FLAG) checkCashBoxOpen();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /* ------------------- Selección de surtidor/productos ------------------- */
  const handlePumpSelect = async (pumpId: number) => {
    if (!pumpId || isNaN(pumpId)) return;
    setSelectedPumpId(pumpId);
    setSelectedProduct(null);
    setSelectedNozzleId(null);
    setError(null);
    setMergedCards([]);

    try {
      const allNozzlesRaw = await nozzleService.getAllNozzles();

      const nozzlesArr = asArray<any>(allNozzlesRaw)
        .filter((n) => Number(n.pump_id) === Number(pumpId))
        .map((n) => ({
          ...n,
          // Normalizamos para que SIEMPRE haya product_id
          product_id: Number(n?.product_id ?? n?.product?.id ?? 0),
        }));
      setCurrentPumpNozzles(nozzlesArr);

      const directMap: Record<number, number> = {};
      const cardsFromNozzles =
        nozzlesArr
          .map((nz: any) => {
            const prodRaw = nz.product ?? nz.producto ?? {};
            const producto = mapProductRaw(prodRaw);
            const nozzle_id = Number(nz.nozzle_id ?? nz.id);
            if (producto.id) directMap[producto.id] = nozzle_id;
            return producto.id ? { nozzle_id, producto } : null;
          })
          .filter(Boolean) as Array<{ nozzle_id: number; producto: Product }>;

      setNozzleByProduct(directMap);
      setPumpNozzles(cardsFromNozzles as any);

      let tanksRaw: any[] = [];
      try {
        tanksRaw = asArray(await apiService.get(`/sales/pumps/${pumpId}/products`));
      } catch {
        tanksRaw = [];
      }

      if (tanksRaw.length === 0) {
        setMergedCards(cardsFromNozzles);
        return;
      }

      const priceById = new Map(products.map(p => [p.id, p.precio]));
      const nozzleMap = new Map<number, { nozzle_id: number; producto: Product }>();
      for (const c of cardsFromNozzles) nozzleMap.set(c.producto.id, c);

      const merged: Array<{ nozzle_id: number | null; producto: Product; disabled?: boolean }> = [];
      const seen = new Set<number>();

      for (const t of tanksRaw) {
        const pr = t.product ?? t.producto ?? t;
        let producto = mapProductRaw(pr);
        if ((!producto.precio || producto.precio <= 0) && priceById.has(producto.id)) {
          producto = { ...producto, precio: Number(priceById.get(producto.id)) };
        }
        if (!producto.id) continue;

        const nzHit = nozzleMap.get(producto.id);
        if (nzHit) {
          merged.push({ nozzle_id: nzHit.nozzle_id, producto: nzHit.producto });
        } else {
          merged.push({ nozzle_id: null, producto, disabled: true });
        }
        seen.add(producto.id);
      }

      for (const c of cardsFromNozzles) {
        if (!seen.has(c.producto.id)) merged.push(c);
      }

      setMergedCards(merged);
    } catch (e) {
      console.error(e);
      setPumpNozzles([]);
      setCurrentPumpNozzles([]);
      setNozzleByProduct({});
      setMergedCards([]);
    }
  };

  /* ===================== Cálculo con descuento ===================== */
  useEffect(() => {
    const tax = IGV_BY_FUEL[selectedFuel] ?? 0.18;
    setTaxRate(tax);

    const priceGross = Number(selectedProduct?.precio) || 0;
    const disc = Number(discount) || 0;

    if (entryMode === 'AMOUNT') {
      const amount = Math.max(0, Number(manualAmount) || 0);
      const qty = priceGross > 0 ? amount / priceGross : 0;
      const paidGross = Math.max(0, amount - disc);
      const netBase = paidGross / (1 + tax);
      setTaxAmount(netBase * tax);
      setSubtotal(paidGross);
      const qStr = qty > 0 ? qty.toFixed(2) : '';
      if (qStr !== quantity) setQuantity(qStr);
    } else {
      const qty = Math.max(
        0,
        Number((manualAmount || '').toString().replace(',', '.')) || 0
      );
      const gross = priceGross > 0 ? qty * priceGross : 0;
      const paidGross = Math.max(0, gross - disc);
      const netBase = paidGross / (1 + tax);
      setTaxAmount(netBase * tax);
      setSubtotal(paidGross);
      const qStr = qty > 0 ? qty.toFixed(2) : '';
      if (qStr !== quantity) setQuantity(qStr);
    }
  }, [entryMode, manualAmount, quantity, selectedFuel, discount, selectedProduct]);

  const gallonsNum = Number(quantity || 0);
  const selectedDiscount = useMemo(
    () => discounts.find(d => d.id === selectedDiscountId) || null,
    [discounts, selectedDiscountId]
  );
  const anyEligible = discounts.some(d => gallonsNum >= d.gallons);

  useEffect(() => {
    if (selectedDiscount && gallonsNum < selectedDiscount.gallons && customDiscountRate == null) {
      setSelectedDiscountId(null);
      setDiscount('0');
    }
  }, [gallonsNum, selectedDiscount, customDiscountRate]);

  useEffect(() => {
    if (gallonsNum <= 0) {
      setDiscount('0');
      return;
    }
    if (customDiscountRate != null) {
      const totalDisc = +(customDiscountRate * gallonsNum).toFixed(2);
      setDiscount(String(totalDisc));
      return;
    }
    if (selectedDiscount && gallonsNum >= selectedDiscount.gallons) {
      const totalDisc = +(selectedDiscount.amount * gallonsNum).toFixed(2);
      setDiscount(String(totalDisc));
    }
  }, [gallonsNum, customDiscountRate, selectedDiscount]);

  /* ----------------------- Cliente (buscador) ----------------------- */
  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setClientSearchTerm(`${client.nombre} ${client.apellido}`);
    setShowClientDropdown(false);
  };

  const toggleClientMode = () => {
    setShowClientSearch((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedClient(null);
        setClientSearchTerm('');
        setShowClientDropdown(false);
      }
      return next;
    });
  };

  const DEBOUNCE_MS = 300;
  const normalize = (s: string) =>
    (s || '')
      .normalize('NFD')
      // @ts-ignore unicode escapes
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

  const filterInList = (list: Client[], term: string) => {
    const tnorm = normalize(term);
    const isDni = /^\d{3,}$/.test(term.trim());
    return list
      .filter((c) => {
        const full = normalize(`${c.nombre ?? ''} ${c.apellido ?? ''}`);
        const doc = String(c.documento ?? '');
        return isDni ? doc.includes(term.trim()) : full.includes(tnorm);
      })
      .slice(0, 20);
  };

  useEffect(() => {
    if (!showClientSearch) return;
    const term = clientSearchTerm.trim();

    if (!term) {
      setFilteredClients(clients.slice(0, 10));
      return;
    }

    setSearchingClients(true);

    const t = setTimeout(async () => {
      try {
        let raw: any = null;

        if (typeof (clientService as any).searchClients === 'function') {
          raw = await (clientService as any).searchClients(term);
        } else {
          raw = await clientService.getAllClients();
        }

        const mapped = asArray(raw).map(mapClient) as Client[];
        const list = typeof (clientService as any).searchClients === 'function'
          ? mapped.slice(0, 20)
          : filterInList(mapped, term);

        if (mapped.length) setClients(mapped);
        setFilteredClients(list);
      } catch (e) {
        console.warn('Fallo búsqueda en BD; filtrando local:', e);
        setFilteredClients(filterInList(clients, term));
      } finally {
        setSearchingClients(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [clientSearchTerm, showClientSearch]);

  useEffect(() => {
    if (!showClientSearch || !showClientDropdown) return;

    const onMouseDown = (e: MouseEvent) => {
      const box = clientBoxRef.current;
      if (box && !box.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowClientDropdown(false);
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showClientSearch, showClientDropdown]);

  /* ---------- NUEVO HELPER: boquilla por producto en el surtidor actual ---------- */
  const getNozzleIdForProduct = (product: Product | null): number | null => {
    if (!product) return null;
    const hit = (currentPumpNozzles as any[]).find(
      (n) => Number(n.product_id) === Number(product.id)
    );
    return hit ? Number(hit.nozzle_id) : null;
  };

  /* ------------------ Selección de producto + boquilla ------------------ */
  const handleProductSelect = (product: Product, preselectedNozzleId?: number) => {
    setSelectedProduct(product);
    setSelectedFuel(toFuelType(String(product.nombre)));
    setQuantity('');
    setManualAmount('');
    setError(null);

    if (Number.isFinite(preselectedNozzleId)) {
      setSelectedNozzleId(Number(preselectedNozzleId));
      setShowNozzleModal(false);
      return;
    }

    setSelectedNozzleId(null);

    const availableNozzles: NozzleInGroup[] = (currentPumpNozzles as any[])
      .filter((nz) => {
        const a = nz as any;
        const pidNz = Number(a.product_id ?? a.product?.id ?? a.producto?.id ?? 0);
        const pidSel = Number(product.id);
        if (pidNz && pidSel && pidNz === pidSel) return true;

        const nameNz = String(a.product?.name ?? a.producto?.nombre ?? '').trim().toLowerCase();
        const nameSel = String(product.nombre ?? '').trim().toLowerCase();
        return !!nameNz && !!nameSel && nameNz === nameSel;
      })
      .map((nz) => {
        const a = nz as any;
        return {
          nozzle_id: Number(a.nozzle_id ?? a.id),
          nozzle_number: Number(a.nozzle_number ?? a.number ?? a.nozzle?.number),
          estado: a.estado ?? a.status, // opcional
        } as NozzleInGroup;
      });

    if (availableNozzles.length > 1) {
      setNozzlesForModal(availableNozzles);
      setShowNozzleModal(true);
    } else if (availableNozzles.length === 1) {
      setSelectedNozzleId(Number(availableNozzles[0].nozzle_id));
    } else {
      setError('Este producto está configurado pero no tiene boquilla asignada en este surtidor.');
    }
  };

  /* --------------------- Totales (payload) --------------------- */
  const totalsForPayload = useMemo(() => {
    const qty = Number(quantity) || 0;
    const price = selectedProduct?.precio || 0;
    const disc = Number(discount) || 0;
    const total_amount = qty * price;
    const final_amount = Math.max(0, total_amount - disc);
    return { total_amount, discount_amount: disc, final_amount };
  }, [quantity, selectedProduct, discount]);

  /* ---------------------- Selector de pago ---------------------- */
  const handlePaymentSelect = (key: PaymentKey) => {
    setPaymentMethod(key);
    const opt = availablePayments.find(p => p.key === key);
    const normLabel = normalizePaymentKey(opt?.label);
    const credit = key === 'CREDIT' || normLabel === 'CREDIT';
    setIsCredit(credit);

    if (credit) {
      const plus30 = new Date();
      plus30.setDate(plus30.getDate() + 30);
      setDueDate(toLocalDateInputValue(plus30));
      setCreditModalOpen(true);
    } else {
      setDueDate('');
      setCreditModalOpen(false);
    }
  };

  /* -------------------------- Registrar venta -------------------------- */
  const handleSubmit = async () => {
    try {
      if (cashOpen !== true) { setError(cashMsg || 'Caja no abierta'); return; }
      if (!currentUserId) { setError('No se pudo identificar al usuario (token). Inicie sesión nuevamente.'); return; }
      if (!selectedProduct || !selectedPumpId) { setError('Debe seleccionar surtidor y producto.'); return; }
      if (entryMode === 'GALLONS' && Number(quantity) <= 0) { setError('La cantidad debe ser mayor a 0'); return; }
      if (entryMode === 'AMOUNT' && Number(manualAmount) <= 0) { setError('El importe debe ser mayor a 0'); return; }
      if (availablePayments.length === 0) { setError('No hay métodos de pago activos.'); return; }

      if (paymentMethod === 'CREDIT') {
        if (!selectedClient) { setError('Para ventas a crédito, seleccione un cliente.'); return; }
        if (!dueDate) { setError('Seleccione la fecha de vencimiento del crédito.'); return; }
      }
      
      // 6: Validaciones mínimas
      if (paymentMethod === 'CREDIT' && selectedClient && isCompany(selectedClient) && !selectedDriver) {
        setError('Para ventas a crédito de empresa, selecciona un conductor.');
        return;
      }

      let nozzle_id: number | null = selectedNozzleId;
      if (nozzle_id == null || Number.isNaN(nozzle_id)) {
        nozzle_id = getNozzleIdForProduct(selectedProduct);
      }
      if (nozzle_id == null || Number.isNaN(nozzle_id)) {
        setError('No se encontró boquilla para el producto seleccionado en este surtidor.');
        return;
      }

      setLoading(true); setError(null);

      const pm = availablePayments.find((p) => p.key === paymentMethod);
      if (!pm) { setError('El método de pago seleccionado no está disponible.'); return; }

      const rate = IGV_BY_FUEL[toFuelType(selectedProduct?.nombre) as keyof typeof IGV_BY_FUEL] ?? 0.18;

      const unitPriceWithIgv = Number(selectedProduct?.precio || 0);
      if (!(unitPriceWithIgv > 0)) { setError('El producto no tiene precio válido.'); return; }

      let grossBeforeDiscount = 0;
      let volumeGallons = 0;

      if (entryMode === 'AMOUNT') {
        grossBeforeDiscount = Math.max(0, Number(manualAmount) || 0);
        volumeGallons = unitPriceWithIgv > 0 ? +(grossBeforeDiscount / unitPriceWithIgv).toFixed(3) : 0;
      } else {
        const qty = Number(quantity || manualAmount || 0);
        volumeGallons = +Math.max(0, qty).toFixed(3);
        grossBeforeDiscount = +(volumeGallons * unitPriceWithIgv).toFixed(2);
      }

      const discNum = Math.max(0, Number(discount) || 0);
      const discountApplied = Math.min(discNum, grossBeforeDiscount);
      const finalGross = +(grossBeforeDiscount - discountApplied).toFixed(2);
      if (finalGross <= 0) { setError('El total a pagar debe ser mayor a 0'); return; }

      const totalNet = +((finalGross) / (1 + rate)).toFixed(2);
      const baseNotes = observations || '';
      const notesWithGross = `${baseNotes}${baseNotes ? ' ' : ''}[pagado_bruto=${finalGross.toFixed(2)}]`;
      const { api } = resolveShiftNames();

      const payload: any = {
        user_id: currentUserId,
        client_id: showClientSearch && selectedClient ? selectedClient.id : null,
        nozzle_id: Number(nozzle_id),
        unit_price: +unitPriceWithIgv.toFixed(2),
        volume_gallons: +volumeGallons.toFixed(3),
        gross_amount: +grossBeforeDiscount.toFixed(2),
        total_amount: totalNet,
        final_amount: finalGross,
        payment_method_id: pm.id,
        payment_method: pm.label,
        notes: notesWithGross || undefined,
        status: 'completed',
        shift: api,
        applyDynamicPricing: false,
        igv_rate: rate,
        ...(discountApplied > 0 ? { discount_amount: +discountApplied.toFixed(2) } : {}),
      };

      if (paymentMethod === 'CREDIT' && dueDate) payload.due_date = dueDate;
      
      // 5: Payload: enviar el conductor (si hay)
      if (selectedClient && isCompany(selectedClient) && selectedDriver) {
        payload.company_driver_id = Number(selectedDriver.driver_id);
        payload.notes = `${payload.notes || ''} [driver_name=${selectedDriver.full_name}] [driver_dni=${selectedDriver.dni || ''}] [driver_plate=${selectedDriver.plate || ''}]`.trim();
      }

      // ===== 1) Registrar venta
      const sale = await saleService.createSale(payload);

      // ===== (RÁPIDO) Registrar lectura de medidor como NUEVO registro
      try {
        const last = await apiService.get(`/meter-readings/nozzle/${nozzle_id}/last`).catch(() => null);
        const l: any = Array.isArray(last) ? (last[0] ?? {}) : (last ?? {});
        const initial = Number(l.final ?? l.final_reading ?? 0) || 0;
        await apiService.post('/meter-readings', {
          nozzle_id: Number(nozzle_id),
          user_id: Number(currentUserId),
          initial,
          final: +(initial + Number(volumeGallons || 0)).toFixed(3),
          shift: api,
          status: 'registered',
          reading_timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('MeterReading: no se pudo registrar la lectura nueva:', e);
      }

      // ===== 2) PDF
      try {
        const IGV_RATE = rate;
        const total = Number(sale.final_amount ?? sale.total_amount ?? 0);
        const subtotalCalc = +(total / (1 + IGV_RATE)).toFixed(2);
        const igvCalc = +(total - subtotalCalc).toFixed(2);

        const itemUnitPrice = Number(selectedProduct?.precio ?? sale.unit_price ?? 0);
        const itemQty = Number(quantity || 0);
        const lineTotal = Number.isFinite(Number(sale.total_amount))
          ? Number(sale.total_amount)
          : +(itemQty * itemUnitPrice).toFixed(2);

        const venta: VentaParaRecibo = {
          sale_id: Number(sale.sale_id),
          created_at: sale.created_at ?? sale.sale_timestamp ?? new Date().toISOString(),
          client: sale.client?.name
            ? { name: sale.client.name }
            : (selectedClient
                ? { name: `${selectedClient.nombre ?? ''} ${selectedClient.apellido ?? ''}`.trim() }
                : undefined),
          items: [
            {
              product_name: selectedProduct?.nombre || 'Producto',
              quantity: itemQty,
              unit_price: itemUnitPrice,
              total_amount: lineTotal,
            },
          ] as any,
          subtotal_amount: subtotalCalc,
          igv_amount: igvCalc,
          total_amount: total,
          payment_method: { name: sale.payment_method } as any,
          notes: paymentMethod === 'CREDIT' ? 'Venta a crédito' : observations || undefined,
        };
        
        // 8: PDF/Recibo (opcional pero recomendado)
        const driverLine = selectedDriver ? `Conductor: ${selectedDriver.full_name}${selectedDriver.plate ? ' · Placa: ' + selectedDriver.plate : ''}` : '';
        venta.notes = [venta.notes, driverLine].filter(Boolean).join(' | ');

        const empresa = empresaInfo ?? await fetchEmpresaFromSettings();

        await generarReciboPDF({
          venta,
          empresa,
          formato: 'ticket80',
          fileName: `RECIBO_${venta.sale_id}.pdf`,
          moneda: 'PEN',
          igvRate: IGV_RATE,
        });
      } catch (pdfErr) {
        console.warn('No se pudo generar el PDF del recibo:', pdfErr);
      }

      // ===== 3) UI
      setSuccess('✅ Venta registrada exitosamente');
      await refreshRecentSales();
      resetFormAfterSuccess();
    } catch (err: any) {
      console.error(err);
      const raw =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Error al registrar la venta';

      const text = Array.isArray(raw) ? raw.join(' | ') : String(raw);
      if (err?.response?.status === 403 || /caja\s+no\s+est[aá]\s+abierta/i.test(text)) {
        setCashOpen(false);
        if (!cashMsg) setCashMsg('Caja no abierta para el turno actual. Ábrela en Turnos para habilitar Ventas.');
      }

      setError(text);
    } finally {
      setLoading(false);
    }
  };

  const resetFormAfterSuccess = () => {
    setSelectedClient(null);
    setSelectedProduct(null);
    setSelectedNozzleId(null);
    setClientSearchTerm('');
    setQuantity('');
    setDiscount('0');
    setObservations('');
    setManualAmount('');
    setIsCredit(false);
    setDueDate('');
    setSelectedDiscountId(null);
    setCustomDiscountRate(null);
    // 9: UX y resets
    setSelectedDriver(null);
    setDriverSearch('');
    setDrivers([]);
  };

  const handleCancel = () => {
    if (window.confirm('¿Seguro que desea cancelar la venta?')) {
      setSelectedClient(null);
      setSelectedProduct(null);
      setSelectedNozzleId(null);
      setClientSearchTerm('');
      setQuantity('');
      setDiscount('0');
      setObservations('');
      setSelectedPumpId(null);
      setPumpNozzles([]);
      setCurrentPumpNozzles([]);
      setNozzleByProduct({});
      setPaymentMethod('CASH');
      setManualAmount('');
      setIsCredit(false);
      setDueDate('');
      setMergedCards([]);
      setSelectedDiscountId(null);
      setCustomDiscountRate(null);
      // 9: UX y resets (también en cancelar)
      setSelectedDriver(null);
      setDriverSearch('');
      setDrivers([]);
    }
  };

  /* --------------------------- Ventas recientes --------------------------- */
  const refreshRecentSales = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) { setRecentSales([]); return; }

    setLoadingRecentSales(true);
    try {
      const [salesRaw, allNozzlesRaw, pmCatalogRaw] = await Promise.all([
        saleService.getRecentSales(RECENT_LIMIT),
        nozzleService.getAllNozzles(),
        paymentMethodService.getAll().catch(() => []),
      ]);

      const sales: any[] = asArray<any>(salesRaw);
      const allNozzles: any[] = asArray<any>(allNozzlesRaw);
      const pmCatalog: any[] = asArray<any>(pmCatalogRaw);

      const pmMap = new Map<number, string>();
      for (const m of pmCatalog) {
        const id = Number(m?.payment_method_id ?? m?.id);
        const name = String(m?.method_name ?? m?.name ?? m?.label ?? '').trim();
        if (id && name) pmMap.set(id, name);
      }

      const nozzleMap = new Map<number, { pump_id?: number; product_name?: string; unit_price?: number; nozzle_number?: number }>();
      for (const n of allNozzles) {
        const nozzle_number = Number(n?.nozzle_number ?? n?.number ?? n?.nozzle?.number ?? NaN);
        const nid = Number(n?.nozzle_id ?? n?.id);
        const pump_id = Number(n?.pump_id ?? n?.pump?.pump_id);
        const product_name = String(n?.product?.name ?? n?.producto?.nombre ?? '') || undefined;
        const unit_price = Number(n?.product?.unit_price ?? n?.producto?.precio ?? NaN);
        nozzleMap.set(nid, {
          pump_id,
          product_name,
          unit_price: Number.isFinite(unit_price) && unit_price > 0 ? unit_price : undefined,
          nozzle_number: Number.isFinite(nozzle_number) ? nozzle_number : undefined,
        });
      }

      const priceByFuel: Record<string, number> = Object.fromEntries(
        products.map((p) => [String(p.nombre), Number(p.precio)])
      );
      const pumpNameById = new Map(pumpList.map((p) => [p.pump_id, p.pump_name]));

      const enriched = sales.map((s: any) => {
        const nz = nozzleMap.get(Number(s.nozzle_id));
        const productName = nz?.product_name ?? '—';
        const pumpName =
          pumpNameById.get(nz?.pump_id ?? -1) ??
          (nz?.pump_id ? `Surtidor ${nz.pump_id}` : 'Surtidor —');
        const unitPrice = nz?.unit_price ?? (productName ? priceByFuel[productName] ?? 0 : 0);
        
        const finalNet = Number(s.final_amount ?? s.total_amount ?? 0);
        const discountAmount = Number.isFinite(Number(s.discount_amount))
          ? Number(s.discount_amount)
          : Math.max(0, (Number(s.gross_amount ?? 0) || 0) - finalNet);

        const gallons =
          Number.isFinite(Number(s.volume_gallons))
            ? Number(s.volume_gallons)
            : (unitPrice > 0 ? finalNet / unitPrice : null);

        let uiClientName: string | undefined =
          s?.client?.name ||
          [s?.client?.first_name, s?.client?.last_name].filter(Boolean).join(' ') ||
          s?.client_name;
        if (!uiClientName && s?.client_id) {
          const c = clientById.get(Number(s.client_id));
          if (c)
            uiClientName =
              [c.nombre, c.apellido].filter(Boolean).join(' ') ||
              c.email ||
              `Cliente ${c.id}`;
        }

        const labelFromPayload = (typeof s?.payment_method === 'string' && s.payment_method.trim()) ? s.payment_method.trim() : '';
        const labelFromCatalog = pmMap.get(Number(s?.payment_method_id || 0)) || '';
        const labelFallback = getPaymentLabel(s) || '';
        const paymentLabel = labelFromPayload || labelFromCatalog || labelFallback || '—';

        // 7: Ventas recientes: mostrar conductor
        const driverNameFromNotes = /\[driver_name=([^\]]+)\]/i.exec(String(s.notes || ''))?.[1];
        const driverTag = driverNameFromNotes ? ` · Conductor: ${driverNameFromNotes}` : '';

        return {
          ...s,
          _ui: {
            clientName: uiClientName,
            productName,
            pumpName,
            nozzleNumber: nz?.nozzle_number,
            gallons,
            amountDisplay: finalNet,
            time: fmtTime(s.sale_timestamp),
            dateTime: fmtDateTime(s.sale_timestamp),
            discountAmount,
            discountText:
              discountAmount > 0 ? `Desc: S/ ${discountAmount.toFixed(2)}` : 'Sin descuento',
            paymentLabel,
            driverTag, // Agregado para usar en el render
          },
        };
      });

      setRecentSales(enriched);
    } catch (err: any) {
      if (
        String(err?.message || '').toLowerCase().includes('unauthorized') ||
        err?.response?.status === 401
      ) {
        console.warn('Sesión expirada. Inicia sesión nuevamente.');
      } else {
        console.error(err);
      }
      setRecentSales([]);
    } finally {
      setLoadingRecentSales(false);
    }
  };

  /** --- UI: cards de producto (desde mergedCards) --- */
  const productCards = useMemo(() => mergedCards, [mergedCards]);

  /* ============================== MODAL: Descuento + Observaciones ============================== */
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [tmpDiscountRate, setTmpDiscountRate] = useState<string>('0');
  const [tmpObs, setTmpObs] = useState<string>('');
  const openExtras = () => {
    const baseRate =
      customDiscountRate != null
        ? customDiscountRate
        : (selectedDiscount?.amount ?? (
            gallonsNum > 0 && Number(discount) > 0 ? Number(discount) / gallonsNum : 0
          ));
    setTmpDiscountRate(String((+baseRate).toFixed(2)));
    setTmpObs(observations);
    setExtrasOpen(true);
  };
  const cancelExtras = () => setExtrasOpen(false);
  const saveExtras = () => {
    const rate = Math.max(0, Number(tmpDiscountRate) || 0);
    const totalDisc = +(rate * gallonsNum).toFixed(2);
    setCustomDiscountRate(rate);
    setDiscount(String(totalDisc));
    if (selectedDiscount && Math.abs(rate - selectedDiscount.amount) > 1e-9) {
      setSelectedDiscountId(null);
    }
    setObservations(tmpObs || '');
    setExtrasOpen(false);
  };

  /* ============================== RENDER ============================== */

  const hasPayments = availablePayments.length > 0;
  const selectedPaymentLabel =
    availablePayments.find(p => p.key === paymentMethod)?.label || '—';

  if (loading && clients.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center px-4">
        <div className="text-white text-center text-sm sm:text-base">Cargando datos del servidor...</div>
      </div>
    );
  }
  const discountActive = (customDiscountRate ?? 0) > 0 || Number(discount) > 0 || !!selectedDiscount;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {/* Fondo */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(253,186,116,0.08),transparent),radial-gradient(900px_500px_at_100%_10%,rgba(59,130,246,0.06),transparent)]" />

      {/* Contenido */}
      <div className={`mx-auto max-w-screen-2xl space-y-3 px-2 py-3 sm:p-3 md:p-4 ${cashOpen === false ? 'pointer-events-none select-none opacity-60' : ''}`}>
        {/* Mensajes */}
        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-200">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs sm:text-sm break-words">{error}</p>
              <button onClick={() => setError(null)} className="rounded px-1.5 py-0.5 text-red-100 hover:bg-red-400/20">×</button>
            </div>
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-emerald-200">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs sm:text-sm break-words">{success}</p>
              <button onClick={() => setSuccess(null)} className="rounded px-1.5 py-0.5 text-emerald-100 hover:bg-emerald-400/20">×</button>
            </div>
          </div>
        )}

        {/* ---------- CLIENTE ---------- */}
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="flex shrink-0 items-center gap-1 text-sm font-semibold text-white">
              <User className="text-blue-400" size={14} /> Cliente
            </h3>

            <div ref={clientBoxRef} className="relative flex-1 min-w-[220px]">
              <div className={`flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1 ${!showClientSearch ? 'opacity-60' : ''}`}>
                <Search size={14} className="text-blue-400 shrink-0" />
                <input
                  type="text"
                  value={clientSearchTerm}
                  onChange={(e) => { setClientSearchTerm(e.target.value); setShowClientDropdown(true); }}
                  onFocus={() => setShowClientDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredClients.length > 0) {
                      e.preventDefault();
                      handleClientSelect(filteredClients[0]);
                    }
                    if (e.key === 'Escape') setShowClientDropdown(false);
                  }}
                  className={`h-10 w-full rounded-md border border-slate-600/70 bg-slate-700/90 px-2 text-sm text-white placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 ${!showClientSearch ? 'cursor-not-allowed' : ''}`}
                  placeholder="Buscar cliente por nombre o DNI..."
                  autoComplete="off"
                  disabled={!showClientSearch}
                  readOnly={!showClientSearch}
                />
              </div>

              {showClientDropdown && showClientSearch && (
                <div className="absolute left-0 right-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-700 bg-slate-800 text-xs shadow-xl">
                  {searchingClients && <div className="px-3 py-1.5 text-slate-300">Buscando…</div>}
                  {!searchingClients && filteredClients.length === 0 && (
                    <div className="px-3 py-1.5 text-slate-400">Sin resultados</div>
                  )}
                  {!searchingClients && filteredClients.map((client) => (
                    <button
                      type="button"
                      key={client.id}
                      onClick={() => { handleClientSelect(client); }}
                      className="block w-full px-3 py-1.5 text-left text-white hover:bg-slate-700"
                    >
                      <div className="font-medium truncate">{client.nombre} {client.apellido}</div>
                      <div className="text-[11px] text-slate-400">{client.documento}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={toggleClientMode}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${showClientSearch ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              {showClientSearch ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>

        {/* 4: UI para seleccionar CONDUCTOR */}
        {selectedClient && isCompany(selectedClient) && (
          <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="flex shrink-0 items-center gap-1 text-sm font-semibold text-white">
                <User className="text-emerald-400" size={14} /> Conductor (empresa)
              </h3>

              <div ref={driverBoxRef} className="relative flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1">
                  <Search size={14} className="text-emerald-400 shrink-0" />
                  <input
                    type="text"
                    value={driverSearch}
                    onChange={(e) => { setDriverSearch(e.target.value); setShowDriverDropdown(true); }}
                    onFocus={() => setShowDriverDropdown(true)}
                    placeholder={driversLoading ? 'Cargando conductores…' : 'Buscar por nombre, DNI o placa…'}
                    className="h-10 w-full rounded-md border border-slate-600/70 bg-slate-700/90 px-2 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    disabled={driversLoading}
                  />
                </div>

                {showDriverDropdown && (
                  <div className="absolute left-0 right-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-700 bg-slate-800 text-xs shadow-xl">
                    {driversLoading && <div className="px-3 py-1.5 text-slate-300">Cargando…</div>}
                    {!driversLoading && filteredDrivers.length === 0 && (
                      <div className="px-3 py-1.5 text-slate-400">Sin resultados</div>
                    )}
                    {!driversLoading && filteredDrivers.map((d) => (
                      <button
                        key={d.driver_id}
                        type="button"
                        onClick={() => { setSelectedDriver(d); setDriverSearch(`${d.full_name} · ${d.plate || d.dni || ''}`); setShowDriverDropdown(false); }}
                        className="block w-full px-3 py-1.5 text-left text-white hover:bg-slate-700"
                      >
                        <div className="font-medium truncate">{d.full_name}</div>
                        <div className="text-[11px] text-slate-400">DNI: {d.dni || '—'} · Placa: {d.plate || '—'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedDriver && (
                <span className="shrink-0 rounded-full bg-emerald-600/30 px-2 py-1 text-xs text-emerald-100">
                  Seleccionado: {selectedDriver.full_name}
                </span>
              )}
            </div>
          </div>
        )}

        {/* =================== ARRIBA: Surtidores + Productos + Operación + Pago/Acciones =================== */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          {/* IZQUIERDA */}
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 sm:p-4 md:col-span-1 xl:col-span-5">
            <h3 className="m-0 flex items-center justify-center gap-2 text-sm font-semibold text-white text-center">
              <Fuel size={14} className="text-yellow-400" /> Tipo de combustible
            </h3>

            <div className="mt-2">
              <div className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:justify-center">
                {pumpList.map((pump) => (
                  <button
                    key={pump.pump_id}
                    onClick={() => handlePumpSelect(pump.pump_id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition
                      ${selectedPumpId === pump.pump_id
                        ? 'bg-orange-500 text-white shadow'
                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                      } truncate`}
                    title={pump.pump_name}
                  >
                    {pump.pump_name}
                  </button>
                ))}
              </div>
            </div>

            {/* Productos */}
            <div className="mt-3">
              <div className="grid w-full gap-2 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                {productCards.length > 0 ? (
                  productCards.map((noz: any) => {
                    const p = noz.producto!;
                    const isSelected = selectedProduct?.id === p.id;
                    const base = `min-w-0 w-full h-[60px] rounded-lg ring-1 ring-white/10 shadow-sm transition-all flex items-center gap-3 px-3 hover:-translate-y-0.5 hover:shadow`;
                    const color = getClassesForProduct({ id: p.id, ...(p as any).color_hex ? { color_hex: (p as any).color_hex } : {} });
                    const disabled = !!noz.disabled || noz.nozzle_id == null;

                    return (
                      <button
                        key={`${p.id}-${noz.nozzle_id ?? 'x'}`}
                          onClick={() => {
                            if (disabled) {
                              setError('Este producto está configurado en inventario pero no tiene boquilla asignada en este surtidor.');
                              return;
                            }
                            const formattedProduct: Product = {
                              id: Number(p.id),
                              nombre: String(p.nombre),
                              precio: Number(p.precio),
                              tipo: String(p.tipo),
                            };
                            handleProductSelect(formattedProduct);
                          }}
                        disabled={disabled}
                        className={[
                          base,
                          color.bgClass ?? '',
                          color.textClass,
                          color.hoverClass ?? '',
                          isSelected ? 'ring-2 ring-amber-300/60' : '',
                          disabled ? 'opacity-60 cursor-not-allowed' : ''
                        ].join(' ')}
                        style={color.style}
                        title={
                          disabled
                            ? `${p.nombre} — falta boquilla en este surtidor`
                            : `${p.nombre} - S/ ${Number(p.precio).toFixed(2)}`
                        }
                      >
                        <div className="grid h-7 w-7 place-items-center rounded-full bg-white/15 backdrop-blur-[2px] shrink-0">
                          <Fuel size={16} />
                        </div>

                        <div className="min-w-0 flex-1 text-left leading-tight">
                          <div className="text-sm font-semibold truncate">{p.nombre}</div>
                          <div className="text-[11px] opacity-90">S/ {Number(p.precio).toFixed(2)}</div>
                        </div>

                        {disabled ? (
                          <span className="rounded-full bg-yellow-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-black shrink-0">!</span>
                        ) : isSelected ? (
                          <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-semibold shrink-0">✓</span>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="py-2 text-left text-slate-400 text-sm col-span-full">
                    {selectedPumpId ? 'No hay productos para este surtidor.' : 'Seleccione un surtidor para ver productos.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DERECHA */}
          <div className="md:col-span-1 xl:col-span-7 grid grid-cols-1 gap-3 xl:grid-cols-7">
            {/* CENTRO */}
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 sm:p-4 xl:col-span-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {/* Ingresar importe/galones */}
                <div className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-3 text-center">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      {entryMode === 'AMOUNT' ? 'Ingresar importe (S/)' : 'Ingresar galones'}
                    </h3>
                    <div className="inline-flex items-center rounded-full bg-slate-800 p-0.5 text-xs">
                      <button
                        onClick={() => { setEntryMode('AMOUNT'); setManualAmount(''); }}
                        className={`px-2 py-0.5 rounded-full ${entryMode === 'AMOUNT' ? 'bg-orange-500 text-white' : 'text-slate-300'}`}
                        title="Ingresar en soles"
                      >
                        S/
                      </button>
                      <button
                        onClick={() => { setEntryMode('GALLONS'); setManualAmount(''); }}
                        className={`px-2 py-0.5 rounded-full ${entryMode === 'GALLONS' ? 'bg-orange-500 text-white' : 'text-slate-300'}`}
                        title="Ingresar en galones (visual)"
                      >
                        Gal
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="mx-auto block h-11 w-full max-w-[18rem] sm:max-w-[20rem] md:max-w-[22rem] rounded-md border border-slate-600 bg-slate-800 px-2 text-center text-lg font-bold text-white focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
                    placeholder={entryMode === 'AMOUNT' ? 'S/ 0.00' : '0.00'}
                  />
                  <div className="mt-1 text-xs text-slate-400">
                    Galón:{' '}
                    <span className="font-semibold text-white">
                      {selectedProduct?.nombre || 'No seleccionado'}
                    </span>
                  </div>
                </div>

                {/* Galones (display) */}
                <div className="grid place-items-center rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-3 text-center">
                  <span className="text-slate-400 text-sm">Galones</span>
                  <span className="mb-0.5 text-2xl font-bold text-orange-400">
                    {Number(quantity || 0).toFixed(2)} gal
                  </span>

                  <span
                    className={
                      `mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ` +
                      (discountActive
                        ? 'bg-emerald-600/80 text-white'
                        : anyEligible
                          ? 'bg-emerald-600/40 text-emerald-100'
                          : 'bg-rose-700/50 text-rose-100')
                    }
                  >
                    {discountActive
                      ? 'Descuento activo'
                      : anyEligible
                        ? 'Puedes aplicar un descuento'
                        : 'No aplica descuento'}
                  </span>
                </div>
              </div>

              {/* Total */}
              <div className="grid place-items-center rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-3 text-center">
                <span className="text-slate-400 text-sm">Total</span>
                <span className="mb-0.5 text-2xl font-bold text-green-400">S/ {subtotal.toFixed(2)}</span>
                <span className="text-xs text-slate-400">Galones: {Number(quantity || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* ACCIONES / PAGO */}
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 sm:p-4 space-y-3 xl:col-span-3">
              {/* Método de pago */}
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPaymentsOpen(true)}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
                      title="Elegir método de pago"
                    >
                      <CreditCard size={14} />
                      Método de pago
                    </button>
                    <button
                      onClick={openExtras}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                      title="Descuento y observaciones"
                    >
                      <Plus size={14} />
                      Realizar descuento
                    </button>
                  </div>

                  <div className="hidden min-w-0 text-xs text-slate-300">
                    <span className="mr-1">Seleccionado:</span>
                    <span className="font-semibold text-white truncate inline-block max-w-[220px] align-middle">
                      {selectedPaymentLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-base font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !hasPayments || cashOpen !== true}
                    title={cashOpen === false ? 'Caja no abierta' : (!hasPayments ? 'No hay métodos de pago activos.' : undefined)}
                    className="rounded-md bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-2 text-base font-bold text-white shadow hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
                  >
                    {loading ? 'Registrando…' : 'Registrar Venta'}
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2 text-center">
                <span className="text-xs text-slate-300">Método de pago seleccionado: </span>
                <span className="text-xs font-semibold text-white">{selectedPaymentLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* =================== VENTAS RECIENTES / PAGOS DE CRÉDITOS =================== */}
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 sm:p-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              {recentTab === 'ventas' ? (
                <>
                  <DollarSign size={16} className="text-green-400" /> Ventas recientes
                </>
              ) : (
                <>
                  <CreditCard size={16} className="text-emerald-400" /> Pagos de créditos
                </>
              )}
            </h3>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md overflow-hidden border border-slate-700">
                <button
                  onClick={() => setRecentTab('ventas')}
                  className={`px-2.5 py-1 text-xs ${recentTab === 'ventas' ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                >
                  Ventas
                </button>
                <button
                  onClick={() => setRecentTab('pagosCredito')}
                  className={`px-2.5 py-1 text-xs ${recentTab === 'pagosCredito' ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                >
                  Pagos de créditos
                </button>
              </div>

              <button
                onClick={() => {
                  if (recentTab === 'ventas') {
                    refreshRecentSales(); fetchProductsGlobal(); fetchActivePaymentOptions(); checkCashBoxOpen();
                  } else {
                    refreshCreditPayments();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                disabled={refreshing}
                title="Actualizar"
              >
                <RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>
          </div>

          {recentTab === 'ventas' ? (
            <>
              <div className="hidden grid-cols-5 gap-2 border-b border-slate-700 pb-1 text-xs uppercase tracking-wide text-slate-400 sm:grid">
                <div className="col-span-2">Cliente / Surtidor</div>
                <div>Producto</div>
                <div className="text-center">Monto</div>
                <div className="text-right">Fecha</div>
              </div>

              <div className="divide-y divide-slate-700">
                {pageSales.length === 0 && (
                  <div className="py-3 text-center text-slate-400 text-sm">
                    {loadingRecentSales ? 'Cargando ventas…' : 'No hay ventas recientes'}
                  </div>
                )}

                {pageSales.map((sale: any) => {
                  const key = sale.sale_id || sale.id;
                  const clientName = sale._ui?.clientName || 'Sin cliente';
                  const productName = sale._ui?.productName ?? '—';
                  const pumpName = sale._ui?.pumpName ?? '—';
                  const gallons = sale._ui?.gallons != null ? Number(sale._ui.gallons).toFixed(2) : '—';
                  const amountDisplay = Number(sale._ui?.amountDisplay ?? 0).toFixed(2);
                  const dateTimeStr = sale._ui?.dateTime ?? fmtDateTime(sale.sale_timestamp);
                  const status = sale.status || 'completed';
                  const discountText = sale._ui?.discountText ?? 'Sin descuento';
                  const paymentLabel = sale._ui?.paymentLabel ?? '—';
                  const obsText = cleanNotes(sale?.notes);
                  const driverTag = sale._ui?.driverTag || ''; // Usar el tag pre-calculado

                  return (
                    <div key={key} className="grid grid-cols-1 gap-1.5 py-1.5 sm:grid-cols-5 sm:items-center">
                      <div className="col-span-2 flex itemsCenter gap-2 min-w-0">
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-slate-600 text-xs font-bold text-white shrink-0">
                          {String(clientName).charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div className="text-sm text-slate-300 min-w-0">
                          <div className="font-medium text-white leading-tight truncate">{clientName}</div>
                          <div className="text-xs text-slate-400 truncate">
                            {pumpName}{sale._ui?.nozzleNumber ? ` · Boquilla ${sale._ui.nozzleNumber}` : ''}{driverTag}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-slate-300 truncate">
                        {productName} · {gallons !== '—' ? `${gallons} gal` : '—'}
                      </div>

                      <div className="text-center">
                        <div className="text-base text-green-400 leading-none">S/ {amountDisplay}</div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {discountText} · Pago: {paymentLabel}
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <span className="text-xs text-slate-400">{dateTimeStr}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status === 'completed'
                                ? 'bg-green-700 text-white'
                                : status === 'pending'
                                  ? 'bg-yellow-700 text-white'
                                  : 'bg-red-700 text-white'
                              }`}
                          >
                            {status === 'completed' ? 'Completada' : 'Pendiente'}
                          </span>
                          {obsText && (
                            <span
                              title={obsText}
                              className="cursor-help rounded-full bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white"
                            >
                              Obs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {recentSales.length > PAGE_SIZE && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={12} />
                    Anterior
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setCurrentPage(n)}
                      className={`rounded-md border px-2 py-1 text-xs ${currentPage === n
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="hidden grid-cols-4 gap-2 border-b border-slate-700 pb-1 text-xs uppercase tracking-wide text-slate-400 sm:grid">
                <div className="col-span-2">Cliente / Crédito</div>
                <div className="text-center">Monto</div>
                <div className="text-right">Fecha</div>
              </div>

              <div className="divide-y divide-slate-700">
                {creditPays.length === 0 && (
                  <div className="py-3 text-center text-slate-400 text-sm">
                    {creditPaysLoading ? 'Cargando pagos…' : 'No hay pagos de créditos'}
                  </div>
                )}

                {creditPays.map((it) => {
                  const clientName = it.clientName || 'Sin cliente';
                  const amountDisplay = Number(it.amount ?? 0).toFixed(2);
                  const dateTimeStr = fmtDateTime(it.timestamp);
                  const method = it.method || '—';

                  return (
                    <div key={it.paymentId} className="grid grid-cols-1 gap-1.5 py-1.5 sm:grid-cols-4 sm:items-center">
                      <div className="col-span-2 flex itemsCenter gap-2 min-w-0">
                        <div className="text-sm text-slate-300 min-w-0">
                          <div className="font-medium text-white leading-tight truncate">{clientName}</div>
                          <div className="text-xs text-slate-400 truncate">
                            {it.creditId ? `Crédito #${it.creditId}` : 'Crédito'}
                            {it.saleId ? ` · Venta #${it.saleId}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-base text-emerald-400 leading-none">S/ {amountDisplay}</div>
                        <div className="mt-0.5 text-xs text-slate-400">Método: {method}</div>
                      </div>

                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <span className="text-xs text-slate-400">{dateTimeStr}</span>
                        <span className="rounded-full bg-green-700 px-2 py-0.5 text-xs font-semibold text-white">
                          Registrado
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {creditPaysTotal > CREDIT_PAGE_SIZE && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                    disabled={creditPaysPage === 1}
                    onClick={() => setCreditPaysPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={12} />
                    Anterior
                  </button>
                  <span className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300">
                    {creditPaysPage}
                  </span>
                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                    disabled={creditPaysPage * CREDIT_PAGE_SIZE >= creditPaysTotal}
                    onClick={() => setCreditPaysPage((p) => p * CREDIT_PAGE_SIZE < creditPaysTotal ? p + 1 : p)}
                  >
                    Siguiente
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== Modal Descuento + Observaciones ===== */}
      <Modal
        open={extrasOpen}
        onClose={cancelExtras}
        title="Más opciones"
        footer={
          <>
            <button
              onClick={cancelExtras}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              onClick={saveExtras}
              className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Guardar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {/* Lista de descuentos de configuración */}
          <div>
            <div className="mb-1 text-sm text-slate-300">Descuentos (Configuración)</div>
            <div className="space-y-1.5">
              {discounts.length === 0 && (
                <div className="rounded-md border border-slate-700 bg-slate-800/60 p-2 text-slate-300 text-xs">
                  No hay descuentos configurados.
                </div>
              )}
              {discounts.map((d) => {
                const eligible = gallonsNum >= d.gallons;
                const selected = selectedDiscountId === d.id;
                return (
                  <button
                    key={d.id}
                    disabled={!eligible}
                    onClick={() => {
                      if (!eligible) return;
                      setSelectedDiscountId(d.id);
                      setTmpDiscountRate(String(d.amount.toFixed(2)));
                    }}
                    className={[
                      'w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold transition',
                      eligible
                        ? (selected ? 'bg-emerald-600/90 text-white' : 'bg-slate-800 text-slate-100 hover:bg-slate-700')
                        : 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                    ].join(' ')}
                  >
                    <span className="truncate">{d.name}</span>
                    <span className="shrink-0 opacity-90">S/ {d.amount}/gal · ≥ {d.gallons} gal</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Seleccionado: {selectedDiscount ? selectedDiscount.name : 'Ninguno'}
            </div>
          </div>

          {/* Campo manual de TARIFA por galón */}
          <div>
            <label className="mb-1 block text-sm text-slate-300">Descuento (S/ por galón)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={tmpDiscountRate}
              onChange={(e) => setTmpDiscountRate(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-orange-500"
              placeholder="0.30"
            />
            <div className="mt-1 text-[11px] text-slate-400">
              * Calculado: S/ {(Number(tmpDiscountRate)||0).toFixed(2)} × {gallonsNum.toFixed(2)} gal = <b>S/ {((Number(tmpDiscountRate)||0)*gallonsNum).toFixed(2)}</b>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Observaciones</label>
            <input
              type="text"
              value={tmpObs}
              onChange={(e) => setTmpObs(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-orange-500"
              placeholder="Ingrese observaciones"
            />
          </div>
        </div>
      </Modal>

      {/* ===== Modal: Métodos de pago ===== */}
      <Modal
        open={paymentsOpen}
        onClose={() => setPaymentsOpen(false)}
        title="Selecciona método de pago"
        footer={
          <>
            <button
              onClick={() => setPaymentsOpen(false)}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              Cerrar
            </button>
          </>
        }
      >
        {availablePayments.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availablePayments.map((opt) => (
              <button
                key={opt.key}
                onClick={() => { handlePaymentSelect(opt.key); setPaymentsOpen(false); }}
                className={`w-full min-h-[40px] rounded-md px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400/30 ${
                  paymentMethod === opt.key
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-slate-700 bg-slate-800/60 p-2.5 text-center text-slate-300 text-xs">
            No hay métodos de pago activos.
          </div>
        )}
      </Modal>

      {/* ===== Modal FECHA para Crédito ===== */}
      <Modal
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        title="Fecha de vencimiento del crédito"
        footer={
          <>
            <button
              onClick={() => setCreditModalOpen(false)}
              className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Usar esta fecha
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-sm text-slate-300">Vence el</label>
          <input
            type="date"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-100"
            min={toLocalDateInputValue(new Date())}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <p className="text-xs text-slate-400">* Obligatorio para ventas a crédito.</p>
        </div>
      </Modal>

      {/* ===== Overlay de bloqueo por caja no abierta ===== */}
      {cashOpen === false && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-xl border border-yellow-500/30 bg-slate-800/80 px-5 py-4 text-center shadow-lg">
            <div className="text-xl font-bold text-white">Caja no abierta</div>
            <p className="mt-1 text-base text-slate-200">Abre la caja del turno actual para habilitar Ventas.</p>
            <a
              href="/grifo-turnos"
              className="mt-3 inline-block rounded-md bg-yellow-600 px-3 py-1.5 text-base font-semibold text-white hover:bg-yellow-700"
            >
              Ir a abrir caja
            </a>
          </div>
        </div>
      )}

      {/* Modal de selección de boquilla */}
      <NozzleSelectionModal
        open={showNozzleModal}
        onClose={() => setShowNozzleModal(false)}
        nozzles={nozzlesForModal}
        onSelect={(nozzleId) => {
          setSelectedNozzleId(nozzleId);
          setShowNozzleModal(false);
        }}
        selectedNozzleId={selectedNozzleId}
      />
    </div>
  );
};

export default GrifoNewSale;