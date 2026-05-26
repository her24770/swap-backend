import prisma from "../persistencia/prismaClient.js";

export async function crearNotificacion(
    idUsuario: number,
    mensaje: string,
    idEstado: number
) {
    return prisma.notificacion.create({
        data: { id_usuario: idUsuario, mensaje, id_estado: idEstado },
    });
}
