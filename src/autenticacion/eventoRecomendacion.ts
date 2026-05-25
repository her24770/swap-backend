import prisma from "../persistencia/prismaClient";

export type TipoEvento =
    | "VER_PUBLICACION"
    | "BUSCAR_ETIQUETA"
    | "VER_PERFIL"
    | "CONTACTAR_VENDEDOR"
    | "DEJAR_RESENA"
    | "AGENDAR_TUTORIA"
    | "COMPLETAR_COMPRA";

export const TIPOS_EVENTO_VALIDOS: TipoEvento[] = [
    "VER_PUBLICACION",
    "BUSCAR_ETIQUETA",
    "VER_PERFIL",
    "CONTACTAR_VENDEDOR",
    "DEJAR_RESENA",
    "AGENDAR_TUTORIA",
    "COMPLETAR_COMPRA",
];


// Cada evento tiene un peso asociado que indica cuánto debe influir en las recomendaciones futuras
export async function registrarEventoPublicacion(
    idUsuario: number,
    idPublicacion: number,
    tipoEvento: TipoEvento
): Promise<void> {
    try {
        const evento = await prisma.eventoRecomendacion.findUnique({
            where: { tipo_evento: tipoEvento },
        });
        if (!evento) return;

        const etiquetas = await prisma.publicacionEtiqueta.findMany({
            where: { id_publicacion: idPublicacion },
            select: { id_etiqueta: true },
        });
        if (etiquetas.length === 0) return;

        await Promise.all(
            etiquetas.map(({ id_etiqueta }) =>
                prisma.usuarioEtiqueta.upsert({
                    where: {
                        id_usuario_id_etiqueta: { id_usuario: idUsuario, id_etiqueta },
                    },
                    update: { peso: { increment: evento.peso } },
                    create: { id_usuario: idUsuario, id_etiqueta, peso: evento.peso },
                })
            )
        );
    } catch (error) {
        console.error("[Recomendacion] Error registrando evento:", error);
    }
}


// Evento específico para cuando un usuario marca una publicación como favorita, ya que puede no estar asociado a una publicación específica (ej: si se marca desde el perfil del vendedor)
export async function registrarEventoFavorita(
    idUsuario: number,
    idsEtiquetas: number[]
): Promise<void> {
    try {
        const evento = await prisma.eventoRecomendacion.findUnique({
            where: { tipo_evento: "FAVORITA" },
        });
        if (!evento) return;

        await Promise.all(
            idsEtiquetas.map((id_etiqueta) =>
                prisma.usuarioEtiqueta.upsert({
                    where: {
                        id_usuario_id_etiqueta: { id_usuario: idUsuario, id_etiqueta },
                    },
                    update: { peso: { increment: evento.peso } },
                    create: { id_usuario: idUsuario, id_etiqueta, peso: evento.peso },
                })
            )
        );
    } catch (error) {
        console.error("[Recomendacion] Error registrando favoritas:", error);
    }
}

export async function quitarEventoFavorita(
    idUsuario: number,
    idsEtiquetas: number[]
): Promise<void> {
    try {
        const evento = await prisma.eventoRecomendacion.findUnique({
            where: { tipo_evento: "QUITAR_FAVORITA" },
        });
        if (!evento) return;

        await Promise.all(
            idsEtiquetas.map(async (id_etiqueta) => {
                const registro = await prisma.usuarioEtiqueta.findUnique({
                    where: {
                        id_usuario_id_etiqueta: { id_usuario: idUsuario, id_etiqueta },
                    },
                    select: { peso: true },
                });

                if (!registro) return;

                if (registro.peso + evento.peso <= 0) {
                    await prisma.usuarioEtiqueta.delete({
                        where: {
                            id_usuario_id_etiqueta: { id_usuario: idUsuario, id_etiqueta },
                        },
                    });
                } else {
                    await prisma.usuarioEtiqueta.update({
                        where: {
                            id_usuario_id_etiqueta: { id_usuario: idUsuario, id_etiqueta },
                        },
                        data: { peso: { increment: evento.peso } },
                    });
                }
            })
        );
    } catch (error) {
        console.error("[Recomendacion] Error quitando favoritas:", error);
    }
}
