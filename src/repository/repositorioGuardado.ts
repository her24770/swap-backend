import prisma from "../persistencia/prismaClient";

interface GuardadoRow {
    id_publicacion: number;
}

interface GuardadoEstadoRow {
    is_like: boolean;
    is_save: boolean;
}

const publicacionGuardadaInclude = {
    imagenes: true,
    etiquetas: { include: { etiqueta: true } },
    estadoRel: { select: { id_estado: true, estado: true } },
    tipoPerfil: { select: { id_tipo_perfil: true, tipo_perfil: true } },
    usuario: {
        select: {
            id_usuario: true,
            nombre: true,
            email_institucional: true,
            url_foto_perfil: true,
            calificacion: true
        }
    }
};

export async function buscarPublicacionesGuardadasPorUsuario(idUsuario: number): Promise<any[]> {
    const ids = await buscarIdsPublicacionesGuardadasPorUsuario(idUsuario);
    if (ids.length === 0) return [];

    const publicaciones = await prisma.publicacion.findMany({
        where: {
            id_publicacion: { in: ids }
        },
        include: publicacionGuardadaInclude,
        orderBy: {
            fecha_publicacion: "desc"
        }
    });

    return publicaciones.map((publicacion) => ({
        ...publicacion,
        esGuardada: true
    }));
}

export async function buscarIdsPublicacionesGuardadasPorUsuario(idUsuario: number): Promise<number[]> {
    const guardados = await prisma.$queryRaw<GuardadoRow[]>`
        SELECT id_publicacion
        FROM "Usuario_Publicacion"
        WHERE id_usuario = ${idUsuario}
          AND is_save = true
    `;

    return guardados.map((guardado) => guardado.id_publicacion);
}

export async function guardarPublicacionUsuario(idUsuario: number, idPublicacion: number): Promise<void> {
    await prisma.$executeRaw`
        INSERT INTO "Usuario_Publicacion" (id_usuario, id_publicacion, is_like, is_save)
        VALUES (${idUsuario}, ${idPublicacion}, false, true)
        ON CONFLICT (id_usuario, id_publicacion)
        DO UPDATE SET is_save = true
    `;
}

export async function eliminarGuardadoUsuario(idUsuario: number, idPublicacion: number): Promise<boolean> {
    const guardados = await prisma.$queryRaw<GuardadoEstadoRow[]>`
        SELECT is_like, is_save
        FROM "Usuario_Publicacion"
        WHERE id_usuario = ${idUsuario}
          AND id_publicacion = ${idPublicacion}
        LIMIT 1
    `;

    const guardado = guardados[0];
    if (!guardado || !guardado.is_save) return false;

    if (guardado.is_like) {
        await prisma.$executeRaw`
            UPDATE "Usuario_Publicacion"
            SET is_save = false
            WHERE id_usuario = ${idUsuario}
              AND id_publicacion = ${idPublicacion}
        `;
        return true;
    }

    await prisma.$executeRaw`
        DELETE FROM "Usuario_Publicacion"
        WHERE id_usuario = ${idUsuario}
          AND id_publicacion = ${idPublicacion}
    `;
    return true;
}
