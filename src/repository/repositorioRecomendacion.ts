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

// ─────────────────────────────────────────────
// Recomendaciones personalizadas
// ─────────────────────────────────────────────

// Retorna todas las etiquetas del usuario con su peso acumulado,
// ordenadas de mayor a menor peso. Son la base del scoring personalizado.
export async function obtenerTagsUsuario(idUsuario: number) {
    return prisma.usuarioEtiqueta.findMany({
        where:   { id_usuario: idUsuario },
        orderBy: { peso: "desc" },
        select:  { id_etiqueta: true, peso: true },
    });
}

// Hace un rollup de los pesos del usuario hacia las etiquetas padre (carreras).
// Si una etiqueta es hija, su peso se acumula en su padre.
// Si ya es padre (sin id_etiqueta_padre), se acumula directamente.
// Retorna los ids de los top 2 padres con mayor peso acumulado.
export async function obtenerTop2PadresUsuario(idUsuario: number): Promise<number[]> {
    const tags = await prisma.usuarioEtiqueta.findMany({
        where:   { id_usuario: idUsuario },
        select:  { id_etiqueta: true, peso: true, etiqueta: { select: { id_etiqueta_padre: true } } },
    });

    const pesoPorPadre = new Map<number, number>();
    for (const tag of tags) {
        const padre = tag.etiqueta.id_etiqueta_padre ?? tag.id_etiqueta;
        pesoPorPadre.set(padre, (pesoPorPadre.get(padre) ?? 0) + tag.peso);
    }

    return [...pesoPorPadre.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([id]) => id);
}

// Trae publicaciones activas que comparten al menos una etiqueta con el usuario
// (pre-filtro para no calcular score en publicaciones sin ninguna relación).
// Incluye etiquetas y conteos necesarios para el scoring.
export async function obtenerPublicacionesFiltradas(idsEtiquetasUsuario: number[]) {
    return prisma.publicacion.findMany({
        where: {
            estadoRel: { estado: "activo" },
            etiquetas: { some: { id_etiqueta: { in: idsEtiquetasUsuario } } },
        },
        select: {
            id_publicacion: true,
            me_gusta:       true,
            etiquetas:      { select: { id_etiqueta: true } },
            _count:         { select: { acuerdos: true } },
        },
    });
}

// Trae las top 7 publicaciones activas de un padre (carrera) para el batch.
// Scoring grupal: solo acuerdos y me_gusta (sin Jaccard individual).
// Las publicaciones son las que tienen etiquetas hijas de ese padre.
export async function obtenerPublicacionesPorPadre(idPadre: number, limite: number = 7) {
    // Obtener ids de etiquetas hijas del padre (y el padre mismo)
    const etiquetasDelGrupo = await prisma.etiqueta.findMany({
        where: {
            OR: [
                { id_etiqueta: idPadre },
                { id_etiqueta_padre: idPadre },
            ],
        },
        select: { id_etiqueta: true },
    });

    const idsEtiquetas = etiquetasDelGrupo.map((e) => e.id_etiqueta);

    const publicaciones = await prisma.publicacion.findMany({
        where: {
            estadoRel: { estado: "activo" },
            etiquetas: { some: { id_etiqueta: { in: idsEtiquetas } } },
        },
        select: {
            id_publicacion: true,
            me_gusta:       true,
            _count:         { select: { acuerdos: true } },
        },
    });

    // Score grupal: acuerdos 60% + me_gusta 40%
    const K = 5;
    return publicaciones
        .map((pub) => ({
            id_publicacion: pub.id_publicacion,
            score: (0.6 * pub._count.acuerdos / (pub._count.acuerdos + K)) +
                   (0.4 * pub.me_gusta        / (pub.me_gusta        + K)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limite);
}