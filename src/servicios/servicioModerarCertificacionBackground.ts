import { subirImagenR2, eliminarImagenR2 } from "./servicioR2.js";
import { crearCertificacion } from "../repository/repositorioCertificacion.js";
import { notificarAccionModeracion } from "./servicioModeracion.js";
import {
    moderarYValidarPdfCertificacion,
    RechazoValidacionPdfError,
    RechazoModeracionPdfError,
} from "./servicioModeracionCertificacion.js";

/**
 * Estructura de datos para encolar la moderación de un certificado en background.
 */
export interface TareaModeracionCertificacion {
    idUsuario: number;
    datos: {
        nombre: string;
        lugar_emision: string;
        id_etiqueta: number;
    };
    buffer: Buffer;
    mimetype: string;
}

// Conjunto en memoria para evitar solicitudes duplicadas que se estén procesando simultáneamente
const certificacionesEnProceso = new Set<string>();

/**
 * Genera una clave única en memoria para identificar la solicitud del usuario.
 */
export function generarClaveProcesamiento(
    idUsuario: number,
    nombre: string,
    lugar_emision: string,
    id_etiqueta: number
): string {
    return `${idUsuario}_${nombre.trim().toLowerCase()}_${lugar_emision.trim().toLowerCase()}_${id_etiqueta}`;
}

/**
 * Comprueba si ya existe una solicitud idéntica en proceso en memoria.
 */
export function estaEnProceso(
    idUsuario: number,
    nombre: string,
    lugar_emision: string,
    id_etiqueta: number
): boolean {
    return certificacionesEnProceso.has(
        generarClaveProcesamiento(idUsuario, nombre, lugar_emision, id_etiqueta)
    );
}

/**
 * Pool de concurrencia en memoria para procesar certificaciones en segundo plano.
 * Limita la cantidad de tareas simultáneas protegiendo la CPU, RAM y límites de TPS de AWS/OpenAI.
 */
class PoolModeracionCertificaciones {
    private cola: (() => Promise<void>)[] = [];
    private concurrentesActivos = 0;
    private readonly MAX_CONCURRENTES = 3;
    private readonly MAX_COLA = 50;

    /**
     * Encola una tarea si no se ha superado el límite de espera.
     * Retorna true si fue encolada, false si la cola está llena.
     */
    public encolar(tarea: () => Promise<void>): boolean {
        if (this.cola.length >= this.MAX_COLA) {
            return false;
        }
        this.cola.push(tarea);
        this.procesarSiguiente();
        return true;
    }

    /**
     * Procesa la siguiente tarea disponible si hay slots de concurrencia libres.
     */
    private async procesarSiguiente(): Promise<void> {
        if (this.concurrentesActivos >= this.MAX_CONCURRENTES || this.cola.length === 0) {
            return;
        }

        this.concurrentesActivos++;
        const siguienteTarea = this.cola.shift();

        if (siguienteTarea) {
            try {
                await siguienteTarea();
            } catch {
                // Silenciar errores no controlados para evitar volcar datos sensibles en consola
            } finally {
                this.concurrentesActivos--;
                this.procesarSiguiente();
            }
        }
    }

    /**
     * Devuelve el estado actual de la cola (para monitoreo o pruebas).
     */
    public obtenerEstado() {
        return {
            enEspera: this.cola.length,
            activos: this.concurrentesActivos,
        };
    }
}

export const poolModeracion = new PoolModeracionCertificaciones();

/**
 * Procesa la certificación en background:
 * 1. Ejecuta la validación y moderación (moderarYValidarPdfCertificacion).
 * 2. Si aprueba: sube a R2, crea registro en BD y notifica al usuario en tiempo real.
 * 3. Si falla: descarta de memoria y notifica el motivo al usuario.
 * 4. Limpia la clave en proceso en el bloque finally.
 */
export async function procesarCertificacionEnBackground(tarea: TareaModeracionCertificacion): Promise<void> {
    const clave = generarClaveProcesamiento(
        tarea.idUsuario,
        tarea.datos.nombre,
        tarea.datos.lugar_emision,
        tarea.datos.id_etiqueta
    );
    certificacionesEnProceso.add(clave);

    try {
        // 1. Ejecutar validación y moderación en paralelo
        await moderarYValidarPdfCertificacion(tarea.buffer);

        // 2. Si superó todas las validaciones, subir a R2
        const rutaPdf = await subirImagenR2(
            tarea.buffer,
            tarea.mimetype,
            "certificaciones",
            `cert_${tarea.idUsuario}_${Date.now()}`
        );

        // 3. Crear el registro en la base de datos con compensación en caso de fallo
        try {
            await crearCertificacion({
                id_usuario: tarea.idUsuario,
                nombre: tarea.datos.nombre,
                ruta_pdf: rutaPdf,
                lugar_emision: tarea.datos.lugar_emision,
                id_etiqueta: tarea.datos.id_etiqueta,
            });
        } catch (dbError) {
            try {
                await eliminarImagenR2(rutaPdf);
            } catch {
                // Falla silenciosa de compensación para evitar exponer rutas o datos en logs
            }
            throw dbError;
        }

        // 4. Notificar al usuario que su certificación fue aprobada (DB + Socket.IO)
        await notificarAccionModeracion(
            tarea.idUsuario,
            `Tu certificación "${tarea.datos.nombre}" ha sido validada y aprobada exitosamente.`
        );
    } catch (error: any) {
        // Si fue rechazada por reglas de validación o moderación
        if (
            error instanceof RechazoValidacionPdfError ||
            error instanceof RechazoModeracionPdfError
        ) {
            await notificarAccionModeracion(
                tarea.idUsuario,
                `Tu certificación "${tarea.datos.nombre}" no fue aprobada: ${error.message}`
            );
            return;
        }

        // Si fue un error técnico temporal de servicios externos
        await notificarAccionModeracion(
            tarea.idUsuario,
            `No fue posible procesar tu certificación "${tarea.datos.nombre}" por un error temporal. Por favor, intenta subirla nuevamente.`
        );
    } finally {
        // Liberar la clave para permitir nuevas subidas con esos datos
        certificacionesEnProceso.delete(clave);
    }
}

/**
 * Encola una certificación en el pool de concurrencia para procesamiento en background.
 */
export function encolarModeracionCertificacion(tarea: TareaModeracionCertificacion): boolean {
    return poolModeracion.encolar(() => procesarCertificacionEnBackground(tarea));
}
