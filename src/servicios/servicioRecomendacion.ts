import * as repo from "../repository/repositorioRecomendacion";
import { buscarPublicacionesPorIdsDetallado } from "../repository/repositorioPublicacion";
import redisClient from "../persistencia/redisClient";
import {buscarUsuariosPorIdsDetallado} from "../repository/repositorioUsuario";

type PublicacionCandidata = {
    id_publicacion: number;
    me_gusta: number;
    fecha_publicacion: Date;

    _count: {
        acuerdos: number;
    };
}

type UsuarioCandidato = {
    id_usuario: number;
    nombre: string;
    calificacion: number | null;
    url_foto_perfil: string;

    _count: {
        acuerdos: number;
    };
}

type EtiquetaUsuario = {
    id_usuario: number;
    id_etiqueta: number;
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

export async function generarRecomendacionesTutores() {

    const limiteUsuarios = 50;
    const topResultados  = 10;

    const intervalos = [7, 30, 90];

    // Cache key
    const cacheKey =
        "recomendaciones:tutores";

    // Buscar cache
    const cache = await redisClient.get(cacheKey);

    if (cache) {

        const usuariosCacheados =
            JSON.parse(cache);

        const ids =
            usuariosCacheados.map(
                (u: any) => u.id_usuario
            );

        // Obtener detalle completo
        const usuariosDetallados =
            await buscarUsuariosPorIdsDetallado(ids);

        // Mapa score
        const mapaScores =
            new Map<number, number>();

        usuariosCacheados.forEach((u: any) => {
            mapaScores.set(
                u.id_usuario,
                u.score
            );
        });

        // Reinyectar score
        return usuariosDetallados.map(usuario => ({
            ...usuario,
            score:
                mapaScores.get(
                    usuario.id_usuario
                ) ?? 0
        }));
    }

    // Generar recomendaciones
    for (const intervalo of intervalos) {

        // Trending tags
        const etiquetasTrending: EtiquetaTrending[] =
            await repo.obtenerEtiquetasTrending(
                "tutoria",
                intervalo,
                10
            );

        if (etiquetasTrending.length === 0) {
            continue;
        }

        // Set trending
        const idsEtiquetasTrending = new Set(
            etiquetasTrending.map(
                etiqueta => etiqueta.id_etiqueta
            )
        );

        // Usuarios candidatos
        const usuariosRaw =
            await repo.obtenerUsuariosCandidatos(
                limiteUsuarios
            );

        const usuarios: UsuarioCandidato[] =
            usuariosRaw.map(usuario => ({
                ...usuario,

                calificacion:
                    usuario.calificacion
                        ? Number(usuario.calificacion)
                        : null
            }));
        if (usuarios.length === 0) {
            continue;
        }

        // Etiquetas usuarios
        const etiquetasUsuarios: EtiquetaUsuario[] =
            await repo.obtenerEtiquetasUsuariosCandidatos(
                usuarios.map(u => u.id_usuario)
            );

        // Map:
        // id_usuario -> etiquetas[]
        const mapEtiquetasUsuarios =
            new Map<number, number[]>();

        for (const etiqueta of etiquetasUsuarios) {

            const etiquetasActuales =
                mapEtiquetasUsuarios.get(
                    etiqueta.id_usuario
                );

            if (etiquetasActuales) {

                etiquetasActuales.push(
                    etiqueta.id_etiqueta
                );

            } else {

                mapEtiquetasUsuarios.set(
                    etiqueta.id_usuario,
                    [etiqueta.id_etiqueta]
                );
            }
        }

        // Trending array
        const trendingArray =
            etiquetasTrending.map(
                etiqueta => etiqueta.id_etiqueta
            );

        // Score usuarios
        const usuariosScoreados =
            usuarios.map(usuario => {

                const etiquetasUsuario =
                    mapEtiquetasUsuarios.get(
                        usuario.id_usuario
                    ) || [];

                // Intersección
                const interseccion =
                    etiquetasUsuario.filter(
                        etiqueta =>
                            idsEtiquetasTrending.has(etiqueta)
                    ).length;

                // Unión
                const union = new Set([
                    ...etiquetasUsuario,
                    ...trendingArray
                ]).size;

                // Jaccard
                const jaccardSimilarity =
                    union === 0
                        ? 0
                        : interseccion / union;

                // Score acuerdos
                const acuerdosScore =
                    usuario._count.acuerdos /
                    (usuario._count.acuerdos + 10);

                // Rating
                const rating =
                    Number(usuario.calificacion ?? 0);

                const ratingScore =
                    rating / 5;

                // Score final
                const scoreTotal =
                    (0.45 * jaccardSimilarity) +
                    (0.25 * acuerdosScore) +
                    (0.30 * ratingScore);

                return {
                    ...usuario,
                    score: Number(scoreTotal.toFixed(2))
                };
            });

        // Ordenar
        const usuariosOrdenados =
            usuariosScoreados.sort(
                (a, b) => b.score - a.score
            );

        // Top resultados
        const topUsuarios =
            usuariosOrdenados.slice(
                0,
                topResultados
            );

        // Guardar Redis
        await redisClient.set(
            cacheKey,
            JSON.stringify(
                topUsuarios.map(u => ({
                    id_usuario: u.id_usuario,
                    score: u.score
                }))
            ),
            {
                EX: 1200
            }
        );

        // IDs top
        const topIds =
            topUsuarios.map(
                u => u.id_usuario
            );

        // Obtener detalle completo
        const usuariosDetallados =
            await buscarUsuariosPorIdsDetallado(
                topIds
            );

        // Mapa score
        const mapaScores =
            new Map<number, number>();

        topUsuarios.forEach(u => {
            mapaScores.set(
                u.id_usuario,
                u.score
            );
        });

        // Reinyectar score
        return usuariosDetallados.map(usuario => ({
            ...usuario,
            score:
                mapaScores.get(
                    usuario.id_usuario
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

// Combina dos listas de publicaciones (de dos padres distintos), elimina duplicados
// conservando el score más alto cuando una pub aparece en ambas listas,
// y retorna el resultado ordenado por score descendente.
export function mergearListasGrupo(
    lista1: { id_publicacion: number; score: number }[],
    lista2: { id_publicacion: number; score: number }[]
): { id_publicacion: number; score: number }[] {
    const mapa = new Map<number, number>();

    for (const pub of [...lista1, ...lista2]) {
        const scoreActual = mapa.get(pub.id_publicacion) ?? 0;
        if (pub.score > scoreActual) {
            mapa.set(pub.id_publicacion, pub.score);
        }
    }

    return [...mapa.entries()]
        .map(([id_publicacion, score]) => ({ id_publicacion, score }))
        .sort((a, b) => b.score - a.score);
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