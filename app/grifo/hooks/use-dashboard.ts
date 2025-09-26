import { useCallback, useEffect, useMemo, useState } from "react";

import { Credit, Client, Sale, SalesTrend } from "../types/dashboard";
import { BackupStatus } from "../../grifo-backup/constants/backup.constants";
import { Product } from "../../grifo-inventario/types/productos";
import { Tanks } from "../../grifo-inventario/types/tanques";
import { paymentMethod } from "../../grifo-configuracion/types/payment-methods";
import { BackupHistory } from "../../grifo-backup/types/backup-history";
import { User } from "../../../src/services/userService";
import { Dispensador } from "../../grifo-inventario/types/dispensadores";

import ProductService from "../../../src/services/productService";
import TanksService from "../../../src/services/tanksService";
import paymentMethodService from "../../../src/services/paymentMethodService";
import BackupHistoryService from "../../../src/services/backupHistoryService";
import UserService from "../../../src/services/userService";
import CreditService from "../../../src/services/creditService";
import ClientService from "../../../src/services/clientService";
import SaleService from "../../../src/services/saleService";
import NozzleService from "../../../src/services/nozzleService";
import settingsService from "../../../src/services/settingsService";

export const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28CFF", "#FF6699"];

export default function useDashboard() {
  const [loading, setLoading] = useState(true);
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productos, setProductos] = useState<Product[]>([]);
  const [tanques, setTanques] = useState<Tanks[]>([]);
  const [metodosPago, setMetodosPago] = useState<paymentMethod[]>([]);
  const [historialBackup, setHistorialBackup] = useState<BackupHistory[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [creditos, setCreditos] = useState<Credit[]>([]);
  const [clientes, setClientes] = useState<Client[]>([]);
  const [ventas, setVentas] = useState<Sale[]>([]);
  const [dispensadores, setDispensadores] = useState<Dispensador[]>([]);
  const [turnos, setTurnos] = useState<Record<string,string>>({});
  const [tendenciasVentas, setTendenciasVentas] = useState<SalesTrend[]>([]);

  const [now, setNow] = useState<Date>(new Date());
  const [rangeFilter, setRangeFilter] = useState<"day" | "week" | "month" | "year">("day");
  const [shiftFilter, setShiftFilter] = useState("");
  const [userFilter, setUserFilter] = useState<number | "">("");
  const [pmFilter, setPmFilter] = useState<number | "">("");
  const [productFilter, setProductFilter] = useState<number | "">("");

  // 🔹 Funciones para cargar datos
  const loadProductos = async () => {
    try {
      const productosData = await ProductService.getAllProducts();
      setProductos(productosData);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };
  const loadTanques = async () => {
    try {
      const tanquesData = await TanksService.getAllTanks();
      setTanques(tanquesData);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };
  const loadMetodosPago = async() => {
    try {
      const metodosPagoData = await paymentMethodService.getAll();
      setMetodosPago(metodosPagoData);
    }
    catch (error) {
      console.error("Error cargando datos:", error);
    }
  }
  const loadHistorialBackup = async() => {
    try {
      const historialBackupData = await BackupHistoryService.getLastBackupHistory();
      setHistorialBackup([historialBackupData]);
    }
    catch (error) {
      console.error("Error cargando datos:", error);
    }
  }
  const loadUsuarios = async() => {
    try {
      const usuariosData = await UserService.getAll();
      setUsuarios(usuariosData);
    }
    catch (error) {
      console.error("Error cargando datos:", error);
    }
  }
  const loadCreditos = async() => {
    try {
      const creditosData = await CreditService.getCreditsToDashboard();
      setCreditos(creditosData);
    }
    catch (error) {
      console.error("Error cargando datos:", error);
    }
  }
  const loadClientes = async() => {
    try {
      const clientesData = await ClientService.getClients();
      setClientes(clientesData);
    }
    catch (error) {
      console.error("Error cargando datos:", error);
    }
  }
  const loadVentas = async() => {
    try {
      const ventasData = await SaleService.getSalesThisYear();
      setVentas(ventasData.map(s => ({
        ...s,
        total_amount: Number(s.total_amount),
        discount_amount: Number(s.discount_amount),
        final_amount: Number(s.final_amount),
      })));
    }
    catch (error) {
      console.error("Error cargando datos:", error);
    }
  }
  const loadDispensadores = async() => {
    try {
      const dispensadoresData = await NozzleService.getAllNozzles();
      setDispensadores(dispensadoresData)
    }
    catch (error) {
      console.error("Error cargando datos:", error);
    }
  }
  const loadTurnos = async () => {
    try {
      const turnosData = await settingsService.getShifts();
      setTurnos(turnosData)
    } 
    catch (error) {
      console.error("Error cargando datos:", error);
    }
  };
  const loadTendenciasVentas = async() => {
    try {
      const tendenciasVentasData = await SaleService.getSalesTrend();
      setTendenciasVentas(tendenciasVentasData)
    }
    catch (error) {
      console.error("Error cargando datos:", error)
    }
  }

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProductos(), 
        loadTanques(),
        loadMetodosPago(),
        loadHistorialBackup(),
        loadUsuarios(),
        loadCreditos(),
        loadClientes(),
        loadVentas(),
        loadDispensadores(),
        loadTurnos(),
        loadTendenciasVentas(),
      ]);
      setError(null);
      setAllDataLoaded(true);
    } catch (err) {
      console.error("Error cargando dashboard:", err);
      setError("Error al cargar los datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    if (!loading && (productos.length === 0 || dispensadores.length === 0)) {
      const loadMissingData = async () => {
        if (productos.length === 0) await loadProductos();
        if (dispensadores.length === 0) await loadDispensadores();
      };
      loadMissingData();
    }
  }, [loading, productos.length, dispensadores.length]);

  // Calcular el turno con base en turnos y la hora de la venta
  const isInShift = (saleDate: Date, shiftName: string) => {
    const range = turnos[shiftName];
    if (!range) return false;
  
    const [start, end] = range.split("-");
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
  
    const saleMinutes = saleDate.getHours() * 60 + saleDate.getMinutes();
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
  
    if (startMinutes < endMinutes) {
      return saleMinutes >= startMinutes && saleMinutes < endMinutes;
    }
    return saleMinutes >= startMinutes || saleMinutes < endMinutes;
  };
  
  // Filtrado de ventas
  const filteredSales = useMemo(() => {
    const now = new Date();
    return ventas.filter((sale) => {
      const saleDate = new Date(sale.sale_timestamp);

      // Filtro por rango de fecha
      let passesDateFilter = true;
      
      switch (rangeFilter) {
        case "day":
          const startOfDay = new Date(now);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(now);
          endOfDay.setHours(23, 59, 59, 999);
          passesDateFilter = saleDate >= startOfDay && saleDate <= endOfDay;
          break;
        
        case "week":
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          passesDateFilter = saleDate >= weekAgo && saleDate <= now;
          break;
        
        case "month":
          passesDateFilter = saleDate.getMonth() === now.getMonth() && 
                            saleDate.getFullYear() === now.getFullYear();
          break;
        
        case "year":
          passesDateFilter = saleDate.getFullYear() === now.getFullYear();
          break;
      }
      
      if (!passesDateFilter) return false;

      // Filtro por turno - corregido
      if (shiftFilter && shiftFilter !== "Turnos") {
        if (!isInShift(saleDate, shiftFilter)) return false;
      }

      // Resto de filtros...
      if (userFilter && sale.user_id !== userFilter) return false;
      if (pmFilter && sale.payment_method_id !== pmFilter) return false;
      
      if (productFilter) {
        const nozzle = dispensadores.find(n => n.nozzle_id === sale.nozzle_id);
        if (!nozzle || nozzle.product_id !== productFilter) return false;
      }

      return true;
    });
  }, [ventas, rangeFilter, shiftFilter, userFilter, pmFilter, productFilter, dispensadores]);

  const totalVentas = filteredSales.reduce((acc, s) => acc + (s.final_amount ?? 0), 0);
  const numVentas = filteredSales.length;
  const promedioVenta = numVentas ? totalVentas / numVentas : 0;

  // Índices
  const productById = useMemo(
    () => Object.fromEntries(productos.map((p) => [p.product_id, p])),
    [productos]
  );
  const clientById = useMemo(() => Object.fromEntries(clientes.map((c) => [c.client_id, c])), [clientes]);

  const tanksWithPct = tanques.map((t) => {
    const total = parseFloat(t.total_capacity);
    const current = parseFloat(t.current_stock);
  
    return {
      ...t,
      percent: Math.round((current / total) * 100),
      product: productById[t.product_id],
    };
  });
  
  const lowLevelTanks = tanksWithPct.filter((t) => t.percent < 20);

  const overdueCredits = creditos.filter(
    (c) => new Date(c.due_date) < now && c.status !== "paid"
  );

  // Serie agrupada para la gráfica
  const seriesByRange = useMemo(() => {
    // Si es "day" o "week", no agrupamos: cada venta es un punto
    if (rangeFilter === "day" || rangeFilter === "week") {
      return filteredSales
        .map((s) => ({
          date: new Date(s.sale_timestamp).toISOString(),
          amount: s.final_amount ?? 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // Para los demás rangos, sí agrupamos
    const map: Record<string, { date: string; amount: number }> = {};

    filteredSales.forEach((s) => {
      const d = new Date(s.sale_timestamp);
      let key = "";

      if (rangeFilter === "month") {
        // agrupamos por día
        key = d.toISOString().slice(0, 10); // "2025-08-31"
      } else if (rangeFilter === "year") {
        // agrupamos por mes
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }

      if (!map[key]) {
        map[key] = { date: key, amount: 0 };
      }
      map[key].amount += s.final_amount;
    });

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales, rangeFilter]);

  // Distribución de combustibles
  const fuelDist = useMemo(() => {
    if (productos.length === 0 || dispensadores.length === 0 || ventas.length === 0) {
      return [];
    }

    const byFuel: Record<string, number> = {};

    filteredSales.forEach((sale) => {
      const nozzle = dispensadores.find(n => n.nozzle_id === sale.nozzle_id);
      if (!nozzle) return;

      const product = productById[nozzle.product_id];
      if (!product) return;

      const key = product.name;

      const pricePerGallon = Number(product.unit_price) || 1;
      const gallons = pricePerGallon > 0 ? sale.final_amount / pricePerGallon : 0;

      byFuel[key] = (byFuel[key] || 0) + gallons;
    });

    return Object.entries(byFuel).map(([name, value]) => ({ 
      name, 
      value: Number(value.toFixed(2))
    }));
  }, [filteredSales, dispensadores, ventas.length, productById, productos.length]);

  const getTrend = (range: "day" | "week" | "month" | "year") => {
    return tendenciasVentas.find(t => t.frecuencia === range) || { 
      totalVentas: "0%", 
      numVentas: "0%", 
      promedioVenta: "0%" 
    };
  };

  return {
    COLORS,
    loading, error,
    turnos, productos, tanques, metodosPago, historialBackup, usuarios, creditos, clientes, ventas, dispensadores,
    rangeFilter, setRangeFilter,
    shiftFilter, setShiftFilter,
    userFilter, setUserFilter,
    pmFilter, setPmFilter,
    productFilter, setProductFilter,
    filteredSales, totalVentas, numVentas, promedioVenta,
    productById, clientById,
    tanksWithPct, lowLevelTanks,
    overdueCredits, fuelDist, seriesByRange,
    getTrend,
  };
}

export function getBackupLabel(status: BackupStatus): string {
  switch (status) {
    case BackupStatus.SUCCESS:
      return BackupStatus.SUCCESS;
    case BackupStatus.FAILED:
      return BackupStatus.FAILED;
    default:
      return "Desconocido";
  }
}