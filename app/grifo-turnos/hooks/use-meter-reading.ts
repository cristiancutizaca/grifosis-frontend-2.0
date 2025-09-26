import { useState, useEffect } from "react";
import { Surtidores } from "../../grifo-inventario/types/surtidores";
import { Dispensador } from "../../grifo-inventario/types/dispensadores";
import { MeterReading, CreateMeterReading, UpdateMeterReading, ShiftReading } from "../types/meter-reading";
import PumpService from "../../../src/services/pumpService";
import NozzleService from "../../../src/services/nozzleService";
import MeterReadingService from "../../../src/services/meterReadingService";

export function useMeterReading() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [surtidores, setSurtidores] = useState<Surtidores[]>([]);
    const [dispensadores, setDispensadores] = useState<Dispensador[]>([]);
    const [lecturasMedidor, setLecturasMedidor] = useState<ShiftReading[]>([]);

    // Cargar surtidores, dispensadores y medidores al montar el componente
    const loadData = async () => {
        try {
            setLoading(true);
            const surtidoresData = await PumpService.getAllPumps();
            setSurtidores(surtidoresData);

            const dispensadoresData = await NozzleService.getAllNozzles();
            setDispensadores(dispensadoresData);

            const today = new Date().toISOString().split("T")[0];
            const meterReadingsData = await MeterReadingService.getShiftReadings(today);
            setLecturasMedidor(meterReadingsData);
        } catch (error) {
            console.error("❌ Error al cargar datos:", error);
            setError("Error al cargar datos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const createReading = async (data: CreateMeterReading) => {
        await MeterReadingService.create(data);
        await loadData();
    };

    // 🔹 Actualizar lectura
    const updateReading = async (id: number, data: UpdateMeterReading) => {
        await MeterReadingService.update(id, data);
        await loadData();
    };

    return {
        loading, error,
        surtidores,
        dispensadores,
        lecturasMedidor,
        createReading,
        updateReading,
        reload: loadData,
    }
}