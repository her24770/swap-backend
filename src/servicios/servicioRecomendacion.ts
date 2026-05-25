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

// ─────────────────────────────────────────────
// Scoring personalizado
// ─────────────────────────────────────────────

// Factor de suavizado Bayesiano: evita que publicaciones con pocos acuerdos/likes
// pero alta proporción dominen el ranking. A mayor K, más publicaciones necesitan
// para destacar. Ajustar si el volumen de datos crece mucho.
const K_PERSONALIZADO = 5;

export type TagUsuario = { id_etiqueta: number; peso: number };

// Jaccard ponderado: en lugar de tratar todas las etiquetas del usuario igual,
// pesa la intersección por el peso acumulado del usuario en cada etiqueta.
// Fórmula: suma(peso_usuario[tag] para tag en intersección) / suma(todos los pesos del usuario)
// Ejemplo: usuario tiene Cálculo(5.0) y Física(0.1). Una pub de Cálculo obtiene
// 5.0/5.1 = 0.98, una pub de Física obtiene 0.1/5.1 = 0.02.
export function calcularJaccardPonderado(
    idsPublicacion: number[],
    etiquetasUsuario: TagUsuario[]
): number {
    const setPub    = new Set(idsPublicacion);
    const pesoTotal = etiquetasUsuario.reduce((acc, t) => acc + t.peso, 0);
    if (pesoTotal === 0) return 0;

    const pesoInterseccion = etiquetasUsuario
        .filter((t) => setPub.has(t.id_etiqueta))
        .reduce((acc, t) => acc + t.peso, 0);

    return pesoInterseccion / pesoTotal;
}

// Calcula el score final de relevancia de una publicación para un usuario específico.
// Combina tres señales:
//   50% — similitud ponderada de etiquetas (refleja la fuerza de interés del usuario)
//   30% — demanda de la publicación (cuántos acuerdos tiene)
//   20% — popularidad (cuántos me_gusta tiene)
// Retorna un valor entre 0 y 1. A mayor score, más relevante para ese usuario.
export function calcularScorePersonalizado(
    etiquetasPublicacion: number[],
    etiquetasUsuario: TagUsuario[],
    acuerdos: number,
    meGusta: number
): number {
    const tagScore     = calcularJaccardPonderado(etiquetasPublicacion, etiquetasUsuario);
    const acuerdoScore = acuerdos / (acuerdos + K_PERSONALIZADO);
    const likeScore    = meGusta  / (meGusta  + K_PERSONALIZADO);
    return (0.5 * tagScore) + (0.3 * acuerdoScore) + (0.2 * likeScore);
}