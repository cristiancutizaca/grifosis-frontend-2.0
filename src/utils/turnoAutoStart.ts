import { turnoService } from '../services/turnoService';
import { jwtDecode } from 'jwt-decode';

interface AutoStartTurnoOptions {
    montoInicialDefault?: number;
    showModal?: boolean;
    onTurnoIniciado?: (turno: any) => void;
    onError?: (error: string) => void;
}

export class TurnoAutoStart {
    private static instance: TurnoAutoStart;
    private isProcessing = false;

    static getInstance(): TurnoAutoStart {
        if (!TurnoAutoStart.instance) {
            TurnoAutoStart.instance = new TurnoAutoStart();
        }
        return TurnoAutoStart.instance;
    }

    // Verificar si el usuario es vendedor
    private isVendedor(): boolean {
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            if (!token) return false;

            const decoded: any = jwtDecode(token);
            const role = decoded.role || decoded.rol || '';
            return role === 'seller';
        } catch (error) {
            console.error('Error al verificar el rol del usuario:', error);
            return false;
        }
    }

    // Obtener el user_id del token
    private getUserId(): number | null {
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            if (!token) return null;

            const decoded: any = jwtDecode(token);
            return decoded.user_id || decoded.sub || null;
        } catch (error) {
            console.error('Error al obtener el user_id:', error);
            return null;
        }
    }

    // Verificar si ya se procesó el auto-inicio en esta sesión
    private yaSeProcesoEnSesion(): boolean {
        return sessionStorage.getItem('turno_auto_start_processed') === 'true';
    }

    // Marcar como procesado en esta sesión
    private marcarComoProcesado(): void {
        sessionStorage.setItem('turno_auto_start_processed', 'true');
    }

    // Verificar si hay turno activo
    private async verificarTurnoActivo(userId: number): Promise<boolean> {
        try {
            const turnoActivo = await turnoService.getTurnoActivo(userId);
            return turnoActivo !== null;
        } catch (error) {
            console.error('Error al verificar turno activo:', error);
            return false;
        }
    }

    // Iniciar turno automáticamente
    private async iniciarTurnoAutomatico(userId: number, montoInicial: number): Promise<any> {
        try {
            const nuevoTurno = await turnoService.iniciarTurno({
                user_id: userId,
                monto_inicial: montoInicial
            });

            console.log('✅ Turno iniciado automáticamente:', nuevoTurno);
            return nuevoTurno;
        } catch (error) {
            console.error('❌ Error al iniciar turno automáticamente:', error);
            throw error;
        }
    }

    // Función principal para procesar el auto-inicio
    async procesarAutoInicio(options: AutoStartTurnoOptions = {}): Promise<void> {
        // Evitar procesamiento múltiple
        if (this.isProcessing) {
            console.log('🔄 Auto-inicio de turno ya en proceso...');
            return;
        }

        // Verificar si ya se procesó en esta sesión
        if (this.yaSeProcesoEnSesion()) {
            console.log('✅ Auto-inicio de turno ya procesado en esta sesión');
            return;
        }

        this.isProcessing = true;

        try {
            // Verificar si el usuario es vendedor
            if (!this.isVendedor()) {
                console.log('👤 Usuario no es vendedor, omitiendo auto-inicio de turno');
                this.marcarComoProcesado();
                return;
            }

            const userId = this.getUserId();
            if (!userId) {
                console.log('❌ No se pudo obtener el user_id del token');
                this.marcarComoProcesado();
                return;
            }

            console.log('🔍 Verificando turno activo para usuario:', userId);

            // Verificar si ya tiene un turno activo
            const tieneeTurnoActivo = await this.verificarTurnoActivo(userId);
            if (tieneeTurnoActivo) {
                console.log('✅ Usuario ya tiene un turno activo');
                this.marcarComoProcesado();
                return;
            }

            console.log('🚀 Iniciando turno automáticamente...');

            // Configurar monto inicial
            const montoInicial = options.montoInicialDefault || 0;

            if (options.showModal) {
                // Si se requiere mostrar modal, delegar la responsabilidad
                console.log('📋 Delegando inicio de turno a modal...');
                this.marcarComoProcesado();
                return;
            }

            // Iniciar turno automáticamente
            const nuevoTurno = await this.iniciarTurnoAutomatico(userId, montoInicial);

            // Callback de éxito
            if (options.onTurnoIniciado) {
                options.onTurnoIniciado(nuevoTurno);
            }

            this.marcarComoProcesado();

        } catch (error: any) {
            console.error('❌ Error en auto-inicio de turno:', error);
            
            // Callback de error
            if (options.onError) {
                options.onError(error.message || 'Error al iniciar turno automáticamente');
            }

            this.marcarComoProcesado();
        } finally {
            this.isProcessing = false;
        }
    }

    // Resetear el estado de procesamiento (útil para testing o casos especiales)
    resetearEstado(): void {
        sessionStorage.removeItem('turno_auto_start_processed');
        this.isProcessing = false;
    }

    // Verificar si se debe mostrar modal de inicio de turno
    async deberMostrarModalInicio(): Promise<boolean> {
        if (!this.isVendedor()) return false;
        
        const userId = this.getUserId();
        if (!userId) return false;

        const tieneeTurnoActivo = await this.verificarTurnoActivo(userId);
        return !tieneeTurnoActivo && !this.yaSeProcesoEnSesion();
    }
}

// Instancia singleton
export const turnoAutoStart = TurnoAutoStart.getInstance();

