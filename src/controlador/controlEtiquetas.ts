import { Request, Response, NextFunction } from "express";
import { obtenerEtiquetasPorUsuario, obtenerEtiquetasPorPublicacion, obtenerTodasLasEtiquetas } from "../repository/repositorioEtiqueta";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario";
import { buscarPublicacionPorId } from "../repository/repositorioPublicacion";
import { errorResponse, exitoResponse } from "../servicios/Response";

export async function obtenerEtiquetasUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        const includePadre = req.query.padres === "true"; //Incluir la etiqueta padre

        if (isNaN(idUsuario)) {
            errorResponse(res, "El id del usuario no es valido", 400);
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "El usuario no existe", 404);
            return;
        }

        const etiquetas = await obtenerEtiquetasPorUsuario(idUsuario, includePadre);
        if (etiquetas.length === 0) {
            errorResponse(res, "No se encontraron etiquetas", 404);
            return;
        }

        exitoResponse(res, etiquetas, "Etiquetas obtenidas exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerEtiquetasPublicacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        const includePadre = req.query.padres === "true"; //Incluir la etiqueta padre

        if (isNaN(idPublicacion)) {
            errorResponse(res, "El id de la publicacion no es valido", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            errorResponse(res, "La publicacion no existe", 404);
            return;
        }

        const etiquetas = await obtenerEtiquetasPorPublicacion(idPublicacion, includePadre);
        if (etiquetas.length === 0) {
            errorResponse(res, "No se encontraron etiquetas", 404);
            return;
        }

        exitoResponse(res, etiquetas, "Etiquetas obtenidas exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerEtiquetas(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const etiquetas = await obtenerTodasLasEtiquetas();
        if (etiquetas.length === 0) {
            errorResponse(res, "No se encontraron etiquetas", 404);
            return;
        }

        exitoResponse(res, etiquetas, "Etiquetas obtenidas exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}