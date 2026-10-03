import { Request, Response, NextFunction } from "express";
import { generarRecomendaciones, mergearListasGrupo, calcularScorePersonalizado, generarRecomendacionesTutores } from "../servicios/servicioRecomendacion";
import { obtenerTipoPerfilPorNombre } from "../repository/repositorioTipoPerfil";
import { errorResponse, exitoResponse } from "../servicios/Response";
import {
    obtenerTop2PadresUsuario,
    obtenerTagsUsuario,
    obtenerPublicacionesFiltradas,
    obtenerPublicacionesPorPadre,
    obtenerSimilaresPorJaccard,
} from "../repository/repositorioRecomendacion";
import { buscarPublicacionesPorIdsDetallado } from "../repository/repositorioPublicacion";
import { registrarInteraccionPublicacion, registrarFavoritasUsuario, eliminarFavoritasUsuario, TipoEvento, TIPOS_EVENTO_VALIDOS } from "../autenticacion/eventoRecomendacion";
import redisClient from "../persistencia/redisClient";

export async function obtenerRecomendacionesGlobales(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {

    try {

        // Tipo opcional
        const tipo = req.params.tipo
            ? (
                Array.isArray(req.params.tipo)
                    ? req.params.tipo[0]
                    : req.params.tipo
            )
            : undefined;

        // Validar tipo si existe
        if (tipo) {
            const tipoPerfil = await obtenerTipoPerfilPorNombre(tipo);
            if (!tipoPerfil) {
                errorResponse(res,"El tipo de publicación no existe",404);
                return;
            }
        }

        // Generar recomendaciones
        const recomendaciones = await generarRecomendaciones(tipo);

        // Sin recomendaciones NO es error
        if (recomendaciones.length === 0) {
            errorResponse(res, "No hay recomendaciones disponibles actualmente", 404);
            return;
        }
        // Respuesta exitosa
        exitoResponse(res, recomendaciones, "Recomendaciones obtenidas exitosamente", 200);

    } catch (error) {
        next(error);
    }
}

// GET /recomendacion/tutores
// Genera recomendaciones para tutores basadas en etiquetas trending de tutorías.
export async function obtenerRecomendacionesTutores(
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {

    try {

        // Generar recomendaciones de tutores
        const recomendaciones =
            await generarRecomendacionesTutores();

        // Sin recomendaciones
        if (recomendaciones.length === 0) {

            errorResponse(
                res,
                "No hay tutores recomendados actualmente",
                404
            );

            return;
        }

        // Respuesta exitosa
        exitoResponse(
            res,
            recomendaciones,
            "Tutores recomendados obtenidos exitosamente",
            200
        );

    } catch (error) {

        next(error);
    }
}

// GET /recomendacion/personalizadas
// Sirve las recomendaciones del home. Lee las listas del batch (top 2 padres del usuario)
// desde Redis, las mergea y devuelve hasta 14 publicaciones ordenadas por score.
// Si una lista no está en Redis la calcula en el momento y la cachea.
export async function obtenerRecomendacionesPersonalizadas(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);

        const top2Padres = await obtenerTop2PadresUsuario(idUsuario);

        if (top2Padres.length === 0) {
            errorResponse(res, "No hay recomendaciones disponibles aún", 404);
            return;
        }

        // Obtener listas desde Redis o calcular si no están
        const listas = await Promise.all(
            top2Padres.map(async (idPadre) => {
                const cacheKey = `rec:grupo:${idPadre}`;
                const cached   = await redisClient.get(cacheKey);

                if (cached) return JSON.parse(cached) as { id_publicacion: number; score: number }[];

                const pubs = await obtenerPublicacionesPorPadre(idPadre, 7);
                await redisClient.set(cacheKey, JSON.stringify(pubs), { EX: 43200 });
                return pubs;
            })
        );

        const merged  = mergearListasGrupo(listas[0] ?? [], listas[1] ?? []);
        const ids     = merged.map((p) => p.id_publicacion);
        const detalle = await buscarPublicacionesPorIdsDetallado(ids);

        const mapaScores = new Map(merged.map((p) => [p.id_publicacion, p.score]));
        const resultado  = detalle.map((pub) => ({ ...pub, score: mapaScores.get(pub.id_publicacion) ?? 0 }));

        exitoResponse(res, resultado, "Recomendaciones personalizadas obtenidas exitosamente");
    } catch (error) {
        next(error);
    }
}

// GET /recomendacion/mias
// Cálculo exacto con los pesos reales del usuario. Sin cache — para cuando el usuario
// quiere ver sus recomendaciones precisas. Usa Jaccard ponderado y pre-filtro.
export async function obtenerRecomendacionesMias(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idUsuario    = Number(req.usuario?.sub);
        const tagsUsuario  = await obtenerTagsUsuario(idUsuario);

        if (tagsUsuario.length === 0) {
            errorResponse(res, "Aún no tienes intereses registrados", 404);
            return;
        }

        const idsEtiquetas   = tagsUsuario.map((t) => t.id_etiqueta);
        const publicaciones  = await obtenerPublicacionesFiltradas(idsEtiquetas);

        const conScore = publicaciones.map((pub) => ({
            id_publicacion: pub.id_publicacion,
            score: calcularScorePersonalizado(
                pub.etiquetas.map((e: any) => e.id_etiqueta),
                tagsUsuario,
                pub._count.acuerdos,
                pub.me_gusta
            ),
        }));

        const top = conScore.sort((a, b) => b.score - a.score).slice(0, 20);
        const ids     = top.map((p) => p.id_publicacion);
        const detalle = await buscarPublicacionesPorIdsDetallado(ids);

        const mapaScores = new Map(top.map((p) => [p.id_publicacion, p.score]));
        const resultado  = detalle.map((pub) => ({ ...pub, score: mapaScores.get(pub.id_publicacion) ?? 0 }));

        exitoResponse(res, resultado, "Tus recomendaciones exactas obtenidas exitosamente");
    } catch (error) {
        next(error);
    }
}

// GET /recomendacion/similares/:id
// Publicaciones similares a una dada usando Jaccard entre etiquetas. Cache 6h en Redis.
export async function obtenerSimilares(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        const cacheKey      = `rec:similares:${idPublicacion}`;
        const cached        = await redisClient.get(cacheKey);

        let ids: number[];

        if (cached) {
            ids = JSON.parse(cached);
        } else {
            const similares = await obtenerSimilaresPorJaccard(idPublicacion);
            ids = similares.map((s) => s.id_publicacion);
            await redisClient.set(cacheKey, JSON.stringify(ids), { EX: 21600 }); // 6h
        }

        const detalle = await buscarPublicacionesPorIdsDetallado(ids);
        exitoResponse(res, detalle, "Publicaciones similares obtenidas exitosamente");
    } catch (error) {
        next(error);
    }
}

// POST /recomendacion/evento
// Registra una interacción del usuario con una publicación de forma asíncrona.
// Invalida el cache del usuario para que las próximas recomendaciones sean frescas.
export async function registrarEventoUsuario(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idUsuario    = Number(req.usuario?.sub);
        const { id_publicacion, tipo_evento } = req.body;

        if (!id_publicacion || !tipo_evento) {
            errorResponse(res, "Faltan parámetros: id_publicacion y tipo_evento son requeridos", 400);
            return;
        }

        if (!TIPOS_EVENTO_VALIDOS.includes(tipo_evento as TipoEvento)) {
            errorResponse(res, `tipo_evento no válido. Valores aceptados: ${TIPOS_EVENTO_VALIDOS.join(", ")}`, 400);
            return;
        }

        await registrarInteraccionPublicacion(idUsuario, Number(id_publicacion), tipo_evento as TipoEvento);

        exitoResponse(res, null, "Evento registrado");
    } catch (error) {
        next(error);
    }
}

// POST /recomendacion/favoritas
// Registra las etiquetas favoritas del usuario (al registrarse o editar perfil).
export async function agregarFavoritas(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idUsuario     = Number(req.usuario?.sub);
        const { ids_etiquetas } = req.body;

        if (!Array.isArray(ids_etiquetas) || ids_etiquetas.length === 0) {
            errorResponse(res, "ids_etiquetas debe ser un array con al menos un elemento", 400);
            return;
        }

        await registrarFavoritasUsuario(idUsuario, ids_etiquetas.map(Number));

        exitoResponse(res, null, "Favoritas registradas");
    } catch (error) {
        next(error);
    }
}

// DELETE /recomendacion/favoritas
// Quita etiquetas favoritas del usuario descontando el peso correspondiente.
export async function eliminarFavoritas(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idUsuario     = Number(req.usuario?.sub);
        const { ids_etiquetas } = req.body;

        if (!Array.isArray(ids_etiquetas) || ids_etiquetas.length === 0) {
            errorResponse(res, "ids_etiquetas debe ser un array con al menos un elemento", 400);
            return;
        }

        await eliminarFavoritasUsuario(idUsuario, ids_etiquetas.map(Number));

        exitoResponse(res, null, "Favoritas eliminadas");
    } catch (error) {
        next(error);
    }
}