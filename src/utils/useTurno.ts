import { useState, useEffect, useCallback } from 'react';
import { turnoService, Turno, CreateTurnoDto, UpdateTurnoDto } from '../services/turnoService';
import { jwtDecode } from 'jwt-decode';

interface UseTurnoReturn {
    turnoActivo: Turno | null;
    loading: boolean;
    error: string | null;
    iniciarTurno: (montoInicial: number) => Promise<void>;
    finalizarTurno: (montoFinal: number) => Promise<void>;
    refrescarTurno: () => Promise<void>;
    resumenTurno: any;
    loadingResumen: boolean;
}

export const useTurno = (): UseTurnoReturn => {
    const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [resumenTurno, setResumenTurno] = useState<any>(null);
    const [loadingResumen, setLoadingResumen] = useState(false);

    // Obtener el user_id del token
    const getUserId = useCallback((): number | null => {
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            if (!token) return null;

            const decoded: any = jwtDecode(token);
            return decoded.user_id || decoded.sub || null;
        } catch (error) {
            console.error('Error al decodificar el token:', error);
            return null;
        }
    }, []);

    // Verificar si el usuario es vendedor
    const isVendedor = useCallback((): boolean => {
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            if (!token) return false;

            const decoded: any = jwtDecode(token);
            const role = decoded.role || decoded.rol || '';
            return role === 'seller';
        } catch (error) {
            console.error('Error al verificar el rol:', error);
            return false;
        }
    }, []);

    // Cargar turno activo
    const cargarTurnoActivo = useCallback(async () => {
        const userId = getUserId();
        if (!userId || !isVendedor()) {
            setTurnoActivo(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const turno = await turnoService.getTurnoActivo(userId);
            setTurnoActivo(turno);
        } catch (error: any) {
            console.error('Error al cargar turno activo:', error);
            setError(error.message || 'Error al cargar el turno activo');
        } finally {
            setLoading(false);
        }
    }, [getUserId, isVendedor]);

    // Cargar resumen del turno
    const cargarResumenTurno = useCallback(async (turnoId: number) => {
        try {
            setLoadingResumen(true);
            const resumen = await turnoService.calcularResumenTurno(turnoId);
            setResumenTurno(resumen);
        } catch (error: any) {
            console.error('Error al cargar resumen del turno:', error);
        } finally {
            setLoadingResumen(false);
        }
    }, []);

    // Iniciar turno
    const iniciarTurno = useCallback(async (montoInicial: number) => {
        const userId = getUserId();
        if (!userId) {
            throw new Error('Usuario no autenticado');
        }

        try {
            setLoading(true);
            setError(null);
            
            const data: CreateTurnoDto = {
                user_id: userId,
                monto_inicial: montoInicial
            };

            const nuevoTurno = await turnoService.iniciarTurno(data);
            setTurnoActivo(nuevoTurno);
        } catch (error: any) {
            console.error('Error al iniciar turno:', error);
            setError(error.message || 'Error al iniciar el turno');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [getUserId]);

    // Finalizar turno
    const finalizarTurno = useCallback(async (montoFinal: number) => {
        if (!turnoActivo) {
            throw new Error('No hay turno activo para finalizar');
        }

        try {
            setLoading(true);
            setError(null);

            const data: UpdateTurnoDto = {
                monto_final: montoFinal,
                estado: 'finalizado'
            };

            const turnoFinalizado = await turnoService.finalizarTurno(turnoActivo.turno_id, data);
            setTurnoActivo(null); // Ya no hay turno activo
            setResumenTurno(null);
        } catch (error: any) {
            console.error('Error al finalizar turno:', error);
            setError(error.message || 'Error al finalizar el turno');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [turnoActivo]);

    // Refrescar turno
    const refrescarTurno = useCallback(async () => {
        await cargarTurnoActivo();
        if (turnoActivo) {
            await cargarResumenTurno(turnoActivo.turno_id);
        }
    }, [cargarTurnoActivo, cargarResumenTurno, turnoActivo]);

    // Efecto para cargar el turno activo al montar el componente
    useEffect(() => {
        cargarTurnoActivo();
    }, [cargarTurnoActivo]);

    // Efecto para cargar el resumen cuando hay un turno activo
    useEffect(() => {
        if (turnoActivo) {
            cargarResumenTurno(turnoActivo.turno_id);
        } else {
            setResumenTurno(null);
        }
    }, [turnoActivo, cargarResumenTurno]);

    return {
        turnoActivo,
        loading,
        error,
        iniciarTurno,
        finalizarTurno,
        refrescarTurno,
        resumenTurno,
        loadingResumen
    };
};

