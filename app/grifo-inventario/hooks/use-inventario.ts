import { useState, useEffect } from "react";
import moment from "moment";
import { Product } from "../types/productos";
import StockMovementService from "../../../src/services/stockMovementService";
import { getCurrentUser } from '../../grifo-usuario/GrifoUsuarios';
import { useTanques } from './use-tanks';
import { useNotification } from '../../../src/hooks/use-notification';
import { NotificationType } from "../../../src/types/notification";
import { CommonMessages, InventoryMessages } from "../constants/messages";

export function useInventario() {
    const { notifications, addNotification, removeNotification } = useNotification();

    const usuario = getCurrentUser();

    const [currentTime, setCurrentTime] = useState<string | null>(null);

    const [currentMonth] = useState(moment());

    const startOfMonth = currentMonth.clone().startOf("month");

    const daysInMonth = currentMonth.daysInMonth();

    const startDay = startOfMonth.day();

    const [products, setProducts] = useState<Product[]>();

    const [showModal, setShowModal] = useState(false);

    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const [form, setForm] = useState<Partial<Product>>({
        name: "",
        description: "",
        category: "combustible",
        fuel_type: "premium",
        unit: "galón",
        unit_price: 0,
        is_active: true,
    });

    const [tanks, setTanks] = useState<any[]>([]);

    const [selectedTank, setSelectedTank] = useState<number | null>(null);

    const [gallons, setGallons] = useState<number>(0);

    // Sync initial tanks from useTanques (optional, remove if fetch is handled here)
    const { tanks: initialTanks } = useTanques();
    useEffect(() => {
        if (initialTanks && initialTanks.length > 0) {
            setTanks(initialTanks);
        }
    }, [initialTanks]);

    useEffect(() => {
        const updateTime = () => setCurrentTime(moment().format("hh:mm:ss A"));
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    const registrarMovimiento = async (tipo: "IN" | "OUT") => {
        if (selectedTank == null || gallons <= 0) {
            addNotification(CommonMessages.REQUIRED_FIELDS, NotificationType.WARNING);
            return;
        }
    
        const tanque = tanks.find((t) => {
            const tankIdStr = t.tank_id?.toString();
            const tankIdNum = typeof t.tank_id === "string" ? parseInt(t.tank_id, 10) : t.tank_id;
            return tankIdNum === selectedTank || tankIdStr === selectedTank.toString();
        });
        if (!tanque) return;

        const movimiento: "Entrada" | "Salida" = tipo === "IN" ? "Entrada" : "Salida";
    
        const payload = {
            product_id: tanque.product_id,
            tank_id: selectedTank,
            user_id: usuario?.user_id,
            movement_timestamp: new Date().toISOString(),
            movement_type: movimiento,
            quantity: gallons,
            sale_detail_id: null,
            delivery_detail_id: null,
            description: movimiento === "Entrada"
                ? "Ingreso manual al tanque"
                : "Salida manual del tanque"
        };

        try {
            await StockMovementService.createStockMovement(payload);
            setTanks((prevTanks) =>
                prevTanks.map((t) =>
                    t.tank_id === selectedTank
                        ? {
                            ...t,
                            current_stock: tipo === "IN"
                                ? (parseInt(t.current_stock) || 0) + gallons
                                : Math.max((parseInt(t.current_stock) || 0) - gallons, 0)
                        }
                        : t
                )
            );
            addNotification(tipo === "IN" ? InventoryMessages.MOVEMENT_IN : InventoryMessages.MOVEMENT_OUT, NotificationType.SUCCESS);
            setGallons(0);
            setSelectedTank(null);
        } catch (error: any) {
            addNotification(error.message || InventoryMessages.ERROR_SAVE, NotificationType.ERROR);
        }
    };

    return {
        currentTime,
        currentMonth,
        startOfMonth,
        daysInMonth,
        startDay,
        products,
        setProducts,
        showModal,
        setShowModal,
        editingProduct,
        setEditingProduct,
        form,
        setForm,
        tanks,
        selectedTank,
        setSelectedTank,
        gallons,
        setGallons,
        registrarMovimiento,

        // notificaciones
        notifications,
        removeNotification,    
    };
}