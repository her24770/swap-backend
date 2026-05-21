import * as repo from "../repository/repositorioRecomendacion"

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

export async function generarRecomendaciones(
    tipo?: string
) {

    const cant_publicaciones = 200;
    const top_resultados = 10;

    // Fallback progresivo
    const intervalos = [7, 30, 90];

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

        // Score publicaciones
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

        // Retornar top resultados
        return publicacionesOrdenadas.slice(
            0,
            top_resultados
        );
    }

    return [];
}