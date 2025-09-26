import { useState } from "react";
import { ControlCaja } from "../types/cash-control";
import { initialCashControl } from "../data/initial-data";

export function useTurnos() {
    const [cashControl, setCashControl] = useState<ControlCaja>(initialCashControl);

    const [error, setError] = useState<string | null>(null);

    // Actualizar control de caja
    const updateCashControl = (updatedCashControl: Partial<ControlCaja>) => {
        try {
                setCashControl((prev) => ({
                    ...prev,
                    ...updatedCashControl,
                    monto_inicial: typeof updatedCashControl.monto_inicial === 'number' 
                        ? updatedCashControl.monto_inicial 
                        : prev.monto_inicial
                }));
                setError(null);
        } catch (err) {
            setError('Error al actualizar el control de caja');
        }
    };

    return {
        cashControl,
        updateCashControl,
    }
}