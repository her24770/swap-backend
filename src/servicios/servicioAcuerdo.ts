import { buscarConversacionPorId } from "../repository/repositorioMensaje.js";
import { getIO } from "../sockets/ioInstance.js";

export async function notificarActualizacionAcuerdo(
    idConversacion: number,
    idUsuarioActor: number
): Promise<void> {
    const conversacion = await buscarConversacionPorId(idConversacion);

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

    io.to(`usuario:${idOtroUsuario}`).emit("acuerdo:actualizado", {
        id_conversacion: idConversacion,
    });
}