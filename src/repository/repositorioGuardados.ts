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
    // Verificar que existe antes de actualizar
    const existente = await prisma.usuarioPublicacion.findUnique({
        where: { id_usuario_id_publicacion: { id_usuario: idUsuario, id_publicacion: idPublicacion } }
    });
    if (!existente || !existente.is_save) return null; // el controlador puede retornar 404

    return prisma.usuarioPublicacion.update({
        where: { id_usuario_id_publicacion: { id_usuario: idUsuario, id_publicacion: idPublicacion } },
        data: { is_save: false }
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
                    estadoRel: true,
                    tipoPerfil: true,
                    usuario: {
                        select: {
                            id_usuario: true,
                            nombre: true,
                            url_foto_perfil: true,
                            calificacion: true,
                            email_institucional: true,
                        }
                    },
                    // ← AGREGAR: traer la relación del usuario actual
                    usuarioPublicacions: {
                        where: { id_usuario: idUsuario },
                        select: { is_save: true, is_like: true }
                    }
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