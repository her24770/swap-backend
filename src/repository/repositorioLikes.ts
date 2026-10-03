import prisma from "../persistencia/prismaClient";

export async function darLike(idUsuario: number, idPublicacion: number) {
    return prisma.$transaction(async (tx) => {
        const rel = await tx.usuarioPublicacion.upsert({
            where: {
                id_usuario_id_publicacion: { id_usuario: idUsuario, id_publicacion: idPublicacion }
            },
            update: { is_like: true },
            create: { id_usuario: idUsuario, id_publicacion: idPublicacion, is_like: true, is_save: false }
        });

        await tx.publicacion.update({
            where: { id_publicacion: idPublicacion },
            data: { me_gusta: { increment: 1 } }
        });

        return rel;
    });
}

export async function quitarLike(idUsuario: number, idPublicacion: number) {
    return prisma.$transaction(async (tx) => {
        const rel = await tx.usuarioPublicacion.upsert({
            where: {
                id_usuario_id_publicacion: { id_usuario: idUsuario, id_publicacion: idPublicacion }
            },
            update: { is_like: false },
            create: { id_usuario: idUsuario, id_publicacion: idPublicacion, is_like: false, is_save: false }
        });

        // Solo decrementar si el contador es mayor a 0
        await tx.publicacion.updateMany({
            where: { id_publicacion: idPublicacion, me_gusta: { gt: 0 } },
            data: { me_gusta: { decrement: 1 } }
        });

        return rel;
    });
}