/**
 * Convenciones para el campo `tiempo_suspendido` (Usuario y Moderador):
 *   0  -> cuenta activa
 *  -1  -> cuenta bloqueada indefinidamente
 *  >0  -> timestamp Unix (segundos) hasta el cual la cuenta esta suspendida
 *
 * Compartido entre controlAuth.ts (login de Usuario) y controlModerador.ts
 * (login de Moderador), y entre las acciones de controlGestionCuentas.ts,
 * para no duplicar esta logica.
 */

export type AccionEstadoCuenta = "bloquear" | "suspender" | "reactivar";

const SEGUNDOS_POR_DIA = 24 * 60 * 60;

export function calcularTiempoSuspendido(accion: AccionEstadoCuenta, dias?: number): number {
    if (accion === "bloquear") return -1;
    if (accion === "reactivar") return 0;

    // accion === "suspender"
    if (!dias || dias <= 0) {
        throw new Error("Se requiere una cantidad de dias positiva para suspender una cuenta.");
    }
    const ahora = Math.floor(Date.now() / 1000);
    return ahora + dias * SEGUNDOS_POR_DIA;
}

export interface EstadoCuentaInterpretado {
    bloqueada: boolean;
    suspendidaHasta: Date | null;
    expirada: boolean;
}

export function interpretarEstadoCuenta(tiempoSuspendido: number): EstadoCuentaInterpretado {
    if (tiempoSuspendido === -1) {
        return { bloqueada: true, suspendidaHasta: null, expirada: false };
    }

    if (tiempoSuspendido === 0) {
        return { bloqueada: false, suspendidaHasta: null, expirada: false };
    }

    const ahora = Math.floor(Date.now() / 1000);
    if (tiempoSuspendido > ahora) {
        return { bloqueada: false, suspendidaHasta: new Date(tiempoSuspendido * 1000), expirada: false };
    }

    // La suspension ya paso su fecha: el llamador debe resetear a 0.
    return { bloqueada: false, suspendidaHasta: null, expirada: true };
}
