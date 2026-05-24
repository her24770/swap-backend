import prisma from "../persistencia/prismaClient";
import { Prisma } from "@prisma/client";

// Type para respuesta de etiquetas trending
type EtiquetasTrending = {
    id_etiqueta: number;
    frecuencia: number;
}

// Obtiene etiquetas trending
export async function obtenerEtiquetasTrending(
    tipo: string | undefined,
    intervalo: number,
    limit: number
): Promise<EtiquetasTrending[]> {

    const tipoFiltro = tipo
        ? Prisma.sql`AND tp.tipo_perfil = ${tipo}`
        : Prisma.empty;

    return prisma.$queryRaw<EtiquetasTrending[]>`
        SELECT
            pe.id_etiqueta AS id_etiqueta,
            COUNT(*)::int AS frecuencia
        FROM
            "Acuerdo" a
        INNER JOIN
            "Publicacion" p
            ON p.id_publicacion = a.id_publicacion
        INNER JOIN
            "Publicacion_Etiquetas" pe
            ON pe.id_publicacion = p.id_publicacion
        INNER JOIN
            "Estado" e
            ON e.id_estado = a.estado
        INNER JOIN
            "Tipo_Perfil" tp
            ON tp.id_tipo_perfil = p.tipo_publicacion
        WHERE
            e.estado = 'completado'
            ${tipoFiltro}
            AND a.fecha_entrega >=
                NOW() - (${intervalo} * INTERVAL '1 day')
        GROUP BY
            pe.id_etiqueta
        ORDER BY
            frecuencia DESC
        LIMIT ${limit}
    `;
}

// Obtiene publicaciones candidatas
export async function obtenerPublicacionesCandidatas(
    limit: number,
    tipo: string | undefined
) {
    const where: any = {
        estadoRel: {
            estado: 'activo'
        }
    };
    // Filtro opcional por tipo
    if (tipo) {
        where.tipoPerfil = {
            tipo_perfil: tipo
        };
    }
    return prisma.publicacion.findMany({
        where,
        select: {
            id_publicacion: true,
            me_gusta: true,
            fecha_publicacion: true,
            _count: {
                select: {
                    acuerdos: true
                }
            }
        },
        take: limit,
        orderBy: {
            fecha_publicacion: 'desc'
        }
    });
}

// Obtiene etiquetas de publicaciones candidatas
export async function obtenerEtiquetasPublicacionCandidata(
    ids_publicaciones: number[]
) {

    return prisma.publicacionEtiqueta.findMany({

        where: {
            id_publicacion: {
                in: ids_publicaciones
            }
        },

        select: {
            id_publicacion: true,
            id_etiqueta: true
        }
    });
}