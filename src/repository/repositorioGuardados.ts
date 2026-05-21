import prisma from "../persistencia/prismaClient";

export async function guardarPublicacion(idUsuario: number, idPublicacion: number) {
    return prisma.usuarioPublicacion.upsert({
        where: {
            id_usuario_id_publicacion: { id_usuario: idUsuario, id_publicacion: idPublicacion }
        },
        update: { is_save: true },
        create: { id_usuario: idUsuario, id_publicacion: idPublicacion, is_save: true, is_like: false }
    });
}

export async function quitarGuardadoPublicacion(idUsuario: number, idPublicacion: number) {
    return prisma.usuarioPublicacion.upsert({
        where: {
            id_usuario_id_publicacion: { id_usuario: idUsuario, id_publicacion: idPublicacion }
        },
        update: { is_save: false },
        create: { id_usuario: idUsuario, id_publicacion: idPublicacion, is_save: false, is_like: false }
    });
}

export async function obtenerGuardadosPorUsuario(idUsuario: number) {
    return prisma.usuarioPublicacion.findMany({
        where: { id_usuario: idUsuario, is_save: true },
        include: {
            publicacion: {
                include: {
                    imagenes: true,
                    etiquetas: { include: { etiqueta: true } },
                    estadoRel: true
                }
            }
        }
    });
}

export async function buscarRelacionUsuarioPublicacion(idUsuario: number, idPublicacion: number) {
    return prisma.usuarioPublicacion.findUnique({
        where: {
            id_usuario_id_publicacion: { id_usuario: idUsuario, id_publicacion: idPublicacion }
        }
    });
}