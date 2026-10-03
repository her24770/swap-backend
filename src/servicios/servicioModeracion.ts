import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { crearNotificacion } from "../repository/repositorioNotificacion.js";
import { getIO } from "../sockets/ioInstance.js";

/**
 * Compartido por todas las acciones de moderacion (publicaciones, cuentas,
 * advertencias): toda accion de moderacion exige un motivo. Extraido de
 * controlPublicacion.ts para que controlGestionCuentas.ts lo reutilice
 * en vez de duplicarlo.
 */
export function obtenerJustificanteModeracion(body: unknown): { motivo: string; detalle: string } | null {
    if (!body || typeof body !== "object") return null;

    const { motivo, detalle } = body as { motivo?: unknown; detalle?: unknown };
    const motivoNormalizado = typeof motivo === "string" ? motivo.trim() : "";
    const detalleNormalizado = typeof detalle === "string" ? detalle.trim() : "";

    if (!motivoNormalizado) return null;

    return {
        motivo: motivoNormalizado.slice(0, 160),
        detalle: detalleNormalizado.slice(0, 500),
    };
}

/**
 * Notifica al usuario afectado por una accion de moderacion, en tiempo real
 * si esta conectado (mismo mecanismo que crearMensajeYNotificar en
 * servicioMensajeria.ts: persistir + emitir "notificacion:nueva").
 */
export async function notificarAccionModeracion(idUsuario: number, mensaje: string): Promise<void> {
    const estadoEnviado = await obtenerEstadoPorNombre("enviado");
    if (!estadoEnviado) return;

    const notificacion = await crearNotificacion(idUsuario, mensaje, estadoEnviado.id_estado);
    const io = getIO();
    io?.to(`usuario:${idUsuario}`).emit("notificacion:nueva", notificacion);
}
