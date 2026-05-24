import { Request, Response, NextFunction } from "express";
import { generarEmbedding } from "../servicios/servicioEmbedding.js";
import { buscarPorSimilitudVectorial, buscarPublicacionesPorIdsDetallado } from "../repository/repositorioPublicacion.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

export async function buscarPublicacionesSemanticamente(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const query = req.query.q as string;
        const tipo = req.query.tipo as string | undefined;

        if (!query || query.trim().length === 0) {
            errorResponse(res, "El parámetro q es requerido", 400);
            return;
        }

        const vector = await generarEmbedding(query.trim());
        const ids = await buscarPorSimilitudVectorial(vector, 20, 0.50, tipo);

        if (ids.length === 0) {
            errorResponse(res, "No se encontraron publicaciones", 404);
            return;
        }

        const publicaciones = await buscarPublicacionesPorIdsDetallado(ids);
        exitoResponse(res, publicaciones, "Búsqueda completada exitosamente", 200);
    } catch (error) {
        next(error);
    }
}
