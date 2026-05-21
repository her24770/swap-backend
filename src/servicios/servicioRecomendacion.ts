import * as repo from "../repository/repositorioRecomendacion";
import { buscarPublicacionesPorIdsDetallado } from "../repository/repositorioPublicacion";
import redisClient from "../persistencia/redisClient";

type PublicacionCandidata = {
    id_publicacion: number;
    me_gusta: number;
    fecha_publicacion: Date;

    _count: {
        acuerdos: number;
    };
}

type EtiquetaPublicacion = {
    id_publicacion: number;
    id_etiqueta: number;
}

type EtiquetaTrending = {
    id_etiqueta: number;
    frecuencia: number;
}

type PublicacionScore = {
    id_publicacion: number;
    score: number;
}

export async function generarRecomendaciones(
    tipo?: string
) {

    const cant_publicaciones = 200;
    const top_resultados = 10;

    // Fallback progresivo
    const intervalos = [7, 30, 90];

    // Cache key
    const cacheKey =
        tipo
            ? `recomendaciones:${tipo}`
            : `recomendaciones:globales`;

    // Intentar obtener desde Redis
    const cache = await redisClient.get(cacheKey);

    if (cache) {

        const recomendacionesCacheadas: PublicacionScore[] =
            JSON.parse(cache);

        // IDs cacheados
        const ids =
            recomendacionesCacheadas.map(
                p => p.id_publicacion
            );

        // Obtener publicaciones completas
        const publicacionesDetalladas =
            await buscarPublicacionesPorIdsDetallado(ids);

        // Mapa score
        const mapaScores =
            new Map<number, number>();

        recomendacionesCacheadas.forEach(p => {
            mapaScores.set(
                p.id_publicacion,
                p.score
            );
        });

        // Reinyectar score
        return publicacionesDetalladas.map(publicacion => ({
            ...publicacion,
            score:
                mapaScores.get(
                    publicacion.id_publicacion
                ) ?? 0
        }));
    }

    // Generar recomendaciones
    for (const intervalo of intervalos) {

        // Etiquetas trending
        const etiquetasTrending: EtiquetaTrending[] =
            await repo.obtenerEtiquetasTrending(
                tipo,
                intervalo,
                10
            );

        // Si no hay trending -> siguiente intervalo
        if (etiquetasTrending.length === 0) {
            continue;
        }

        // Set para búsquedas rápidas
        const idsEtiquetasTrending = new Set(
            etiquetasTrending.map(
                etiqueta => etiqueta.id_etiqueta
            )
        );

        // Publicaciones candidatas
        const publicaciones: PublicacionCandidata[] =
            await repo.obtenerPublicacionesCandidatas(
                cant_publicaciones,
                tipo
            );

        if (publicaciones.length === 0) {
            continue;
        }

        // Etiquetas publicaciones
        const etiquetas: EtiquetaPublicacion[] =
            await repo.obtenerEtiquetasPublicacionCandidata(
                publicaciones.map(
                    p => p.id_publicacion
                )
            );

        // Map:
        // id_publicacion -> etiquetas[]
        const mapEtiquetasPublicaciones =
            new Map<number, number[]>();

        for (const etiqueta of etiquetas) {

            const etiquetasActuales =
                mapEtiquetasPublicaciones.get(
                    etiqueta.id_publicacion
                );

            if (etiquetasActuales) {

                etiquetasActuales.push(
                    etiqueta.id_etiqueta
                );

            } else {

                mapEtiquetasPublicaciones.set(
                    etiqueta.id_publicacion,
                    [etiqueta.id_etiqueta]
                );
            }
        }

        // Array trending
        const trendingArray =
            etiquetasTrending.map(
                etiqueta => etiqueta.id_etiqueta
            );

        // Calcular score
        const publicacionesScores =
            publicaciones.map(publicacion => {

                const etiquetasPublicacion =
                    mapEtiquetasPublicaciones.get(
                        publicacion.id_publicacion
                    ) || [];

                // Intersección
                const interseccion =
                    etiquetasPublicacion.filter(
                        etiqueta =>
                            idsEtiquetasTrending.has(etiqueta)
                    ).length;

                // Unión
                const union = new Set([
                    ...etiquetasPublicacion,
                    ...trendingArray
                ]).size;

                // Jaccard
                const jaccardSimilarity =
                    union === 0
                        ? 0
                        : interseccion / union;

                // Score acuerdos
                const acuerdosScore =
                    publicacion._count.acuerdos /
                    (publicacion._count.acuerdos + 10);

                // Score likes
                const likesScore =
                    publicacion.me_gusta /
                    (publicacion.me_gusta + 10);

                // Score final
                const scoreTotal =
                    (jaccardSimilarity * 0.5) +
                    (acuerdosScore * 0.3) +
                    (likesScore * 0.2);

                return {
                    ...publicacion,
                    score: Number(scoreTotal.toFixed(2))
                };
            });

        // Ordenar
        const publicacionesOrdenadas =
            publicacionesScores.sort(
                (a, b) => b.score - a.score
            );

        // Top resultados
        const topPublicaciones =
            publicacionesOrdenadas.slice(
                0,
                top_resultados
            );

        // Guardar en Redis
        await redisClient.set(
            cacheKey,
            JSON.stringify(
                topPublicaciones.map(p => ({
                    id_publicacion: p.id_publicacion,
                    score: p.score
                }))
            ),
            {
                EX: 1200 // 20 minutos
            }
        );

        // IDs top
        const topIds =
            topPublicaciones.map(
                p => p.id_publicacion
            );

        // Publicaciones completas
        const publicacionesDetalladas =
            await buscarPublicacionesPorIdsDetallado(
                topIds
            );

        // Mapa score
        const mapaScores =
            new Map<number, number>();

        topPublicaciones.forEach(p => {
            mapaScores.set(
                p.id_publicacion,
                p.score
            );
        });

        // Reinyectar score
        return publicacionesDetalladas.map(publicacion => ({
            ...publicacion,
            score:
                mapaScores.get(
                    publicacion.id_publicacion
                ) ?? 0
        }));
    }

    return [];
}