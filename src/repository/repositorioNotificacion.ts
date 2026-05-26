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

export async function obtenerNotificacionesPorUsuario(idUsuario: number) {
    return prisma.notificacion.findMany({
        where: { id_usuario: idUsuario },
        include: { estado: { select: { estado: true } } },
        orderBy: { fecha: 'desc' },
    });
}

export async function obtenerNotificacionPorId(idNotificacion: number) {
    return prisma.notificacion.findUnique({
        where: { id_notificacion: idNotificacion },
    });
}

export async function actualizarEstadoNotificacion(idNotificacion: number, idEstado: number) {
    return prisma.notificacion.update({
        where: { id_notificacion: idNotificacion },
        data: { id_estado: idEstado },
    });
}
