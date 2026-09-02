import { Mensaje, Prisma } from "@prisma/client";
import {
    buscarConversacionEntreDosUsuarios,
    buscarConversacionPorId,
    guardarConversacionConMensajeInicial,
    guardarMensajeConNotificacion,
    buscarConversacionCompletaPorId,
} from "../repository/repositorioMensaje.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { getIO } from "../sockets/ioInstance.js";
import { ErrorServicio } from "./ErrorServicio.js";

interface OpcionesMensaje {
    permitirMensajeInicialPendiente?: boolean;
    idPublicacion?: number;
}

function emitirMensajePersistido(
    idConversacion: number,
    idEmisor: number,
    idReceptor: number,
    resultado: {
        mensaje: unknown;
        notificacion: unknown;
        conversacion: unknown;
    },
): void {
    try {
        const io = getIO();
        if (!io) return;

        io.to(`conversacion:${idConversacion}`).emit("mensaje:nuevo", resultado.mensaje);
        io.to(`usuario:${idReceptor}`).emit("notificacion:nueva", resultado.notificacion);
        if (resultado.conversacion) {
            io.to(`usuario:${idEmisor}`).emit("conversacion:actualizada", resultado.conversacion);
            io.to(`usuario:${idReceptor}`).emit("conversacion:actualizada", resultado.conversacion);
        }
    } catch (error) {
        // El commit ya ocurrió. Un fallo del transporte en tiempo real no debe
        // convertir un mensaje persistido en un 500 ambiguo para el cliente.
        console.error("[Mensajeria] No se pudieron emitir eventos de socket:", error);
    }
}

/**
 * Persiste un mensaje en una conversación existente, crea la notificación
 * para el receptor y emite los eventos de socket correspondientes
 * ("mensaje:nuevo" a la sala de la conversación, "notificacion:nueva" a la
 * sala personal del receptor). La reutilizan tanto el endpoint REST de
 * iniciar conversación como el evento de socket "mensaje:enviar".
 */
export async function crearMensajeYNotificar(
    idConversacion: number,
    idEmisor: number,
    texto: string,
    opciones: OpcionesMensaje = {}
): Promise<Mensaje> {
    const conversacion = await buscarConversacionPorId(idConversacion);
    if (!conversacion) {
        throw new ErrorServicio("Conversación no encontrada", 404);
    }

    const esParticipante = conversacion.id_usuario_1 === idEmisor || conversacion.id_usuario_2 === idEmisor;
    if (!esParticipante) {
        throw new ErrorServicio("No tienes permiso para enviar mensajes en esta conversación", 403);
    }

    const [estadoActivo, estadoPendiente, estadoEnviado] = await Promise.all([
        obtenerEstadoPorNombre("activo"),
        obtenerEstadoPorNombre("pendiente"),
        obtenerEstadoPorNombre("enviado"),
    ]);
    if (!estadoActivo) throw new ErrorServicio("Error de configuración: estado 'activo' no encontrado", 500);
    if (!estadoPendiente) throw new ErrorServicio("Error de configuración: estado 'pendiente' no encontrado", 500);
    if (!estadoEnviado) throw new ErrorServicio("Error de configuración: estado 'enviado' no encontrado", 500);

    const esReintentoInicial = opciones.permitirMensajeInicialPendiente === true
        && conversacion.estado_conversacion === estadoPendiente.id_estado
        && conversacion.id_usuario_1 === idEmisor
        && (conversacion.mensajes?.length ?? 0) === 0;
    if (conversacion.estado_conversacion !== estadoActivo.id_estado && !esReintentoInicial) {
        throw new ErrorServicio("La conversación debe estar activa para enviar mensajes", 400);
    }

    const idReceptor =
        conversacion.id_usuario_1 === idEmisor ? conversacion.id_usuario_2 : conversacion.id_usuario_1;

    const resultado = await guardarMensajeConNotificacion({
        idConversacion,
        idEmisor,
        idReceptor,
        texto,
        idEstadoEnviado: estadoEnviado.id_estado,
        idPublicacion: opciones.idPublicacion,
    });
    emitirMensajePersistido(idConversacion, idEmisor, idReceptor, resultado);
    return resultado.mensaje;
}

export async function crearConversacionConPrimerMensaje(
    idEmisor: number,
    idReceptor: number,
    texto: string,
    idPublicacion?: number,
) {
    const [estadoPendiente, estadoEnviado] = await Promise.all([
        obtenerEstadoPorNombre("pendiente"),
        obtenerEstadoPorNombre("enviado"),
    ]);
    if (!estadoPendiente) throw new ErrorServicio("Error de configuración: estado 'pendiente' no encontrado", 500);
    if (!estadoEnviado) throw new ErrorServicio("Error de configuración: estado 'enviado' no encontrado", 500);

    let resultado;
    try {
        resultado = await guardarConversacionConMensajeInicial({
            idEmisor,
            idReceptor,
            texto,
            idEstadoPendiente: estadoPendiente.id_estado,
            idEstadoEnviado: estadoEnviado.id_estado,
            idPublicacion,
        });
    } catch (error) {
        const esConflictoUnico = error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code === "P2002"
            : typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
        if (!esConflictoUnico) throw error;

        // Dos requests iniciales pudieron observar que no existía conversación.
        // El ganador ya hizo commit; el perdedor devuelve ese mismo resultado.
        const existente = await buscarConversacionEntreDosUsuarios(idEmisor, idReceptor);
        const primerMensaje = existente?.mensajes[0];
        if (!existente || existente.id_usuario_1 !== idEmisor || !primerMensaje || primerMensaje.mensaje !== texto) {
            throw new ErrorServicio("Ya existe una solicitud de conversación con datos diferentes", 409);
        }
        const completa = await buscarConversacionCompletaPorId(existente.id_conversacion);
        if (!completa) throw new ErrorServicio("Conversación no encontrada", 404);
        return { conversacion: completa, mensaje: primerMensaje };
    }
    emitirMensajePersistido(resultado.conversacion.id_conversacion, idEmisor, idReceptor, resultado);
    return { conversacion: resultado.conversacion, mensaje: resultado.mensaje };
}

export async function notificarActualizacionConversacion(
    idConversacion: number,
    idUsuarioActor: number
): Promise<void> {
    const conversacion = await buscarConversacionCompletaPorId(idConversacion);

    if (!conversacion) {
        return;
    }

    const esUsuario1 = conversacion.id_usuario_1 === idUsuarioActor;
    const esUsuario2 = conversacion.id_usuario_2 === idUsuarioActor;

    if (!esUsuario1 && !esUsuario2) {
        return;
    }

    const idOtroUsuario = esUsuario1
        ? conversacion.id_usuario_2
        : conversacion.id_usuario_1;

    const io = getIO();
    if (!io) {
        return;
    }

    io.to(`usuario:${idOtroUsuario}`).emit(
        "conversacion:actualizada",
        conversacion
    );
}
