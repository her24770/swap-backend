import { Mensaje } from "@prisma/client";
import { buscarConversacionPorId, guardarMensaje, buscarConversacionCompletaPorId } from "../repository/repositorioMensaje.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { crearNotificacion } from "../repository/repositorioNotificacion.js";
import { getIO } from "../sockets/ioInstance.js";

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
    texto: string
): Promise<Mensaje> {
    const conversacion = await buscarConversacionPorId(idConversacion);
    if (!conversacion) {
        throw new Error("Conversación no encontrada");
    }

    const idReceptor =
        conversacion.id_usuario_1 === idEmisor ? conversacion.id_usuario_2 : conversacion.id_usuario_1;

    const estadoEnviado = await obtenerEstadoPorNombre("enviado");
    if (!estadoEnviado) {
        throw new Error("Error de configuración: estado 'enviado' no encontrado");
    }

    const mensaje = await guardarMensaje({
        conversacion: { connect: { id_conversacion: idConversacion } },
        emisor: { connect: { id_usuario: idEmisor } },
        mensaje: texto,
        estadoRel: { connect: { id_estado: estadoEnviado.id_estado } },
    });

    const conversacionActualizada = await buscarConversacionCompletaPorId(idConversacion);

    const notificacion = await crearNotificacion(idReceptor, "Tienes un nuevo mensaje", estadoEnviado.id_estado);

    const io = getIO();
    if (io) {
        io.to(`conversacion:${idConversacion}`).emit("mensaje:nuevo", mensaje);
        io.to(`usuario:${idReceptor}`).emit("notificacion:nueva", notificacion);
        if (conversacionActualizada) {
            io.to(`usuario:${idReceptor}`).emit("conversacion:actualizada", conversacionActualizada);
        }
    }

    return mensaje;
}
