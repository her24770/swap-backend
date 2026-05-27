import { Request, Response, NextFunction } from "express";
import { obtenerEtiquetasPorUsuario, obtenerEtiquetasPorPublicacion, obtenerTodasLasEtiquetas, sincronizarEtiquetasUsuario, verificarEtiquetasExisten } from "../repository/repositorioEtiqueta";
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

/**
 * POST /etiqueta/user/:id
 * Sincroniza las etiquetas de un usuario (agrega nuevas, elimina las que ya no están)
 */
export async function sincronizarEtiquetasUsuarioController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const {ids} = req.body;
        // 1. Validar ID de usuario
        const idUsuario = Number(req.params.id);
        if (isNaN(idUsuario)) {
            errorResponse(res, "El ID del usuario no es válido", 400);
            return;
        }

        // 3. Verificar que el usuario existe
        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }

        if(ids.length === 0 ) {
            errorResponse(res, "Debe proporcionar al menos una etiqueta", 400);
            return;
        }


        if (ids.length > 20) {
            errorResponse(res, "No se pueden asignar más de 20 etiquetas a un usuario", 400);
            return;
        }

        // 4. Verificar que todas las etiquetas existen
        const etiquetasExisten = await verificarEtiquetasExisten(ids);
        if (!etiquetasExisten) {
            errorResponse(res, "Una o más etiquetas no existen en el sistema", 400);
            return;
        }

        // 5. Sincronizar etiquetas
        await sincronizarEtiquetasUsuario(idUsuario, ids);

        // 6. Obtener etiquetas actualizadas para respuesta
        const etiquetasActualizadas = await obtenerEtiquetasPorUsuario(idUsuario);

        // 7. Respuesta exitosa
        exitoResponse(res, etiquetasActualizadas, "Etiquetas actualizadas exitosamente", 200);
        
    } catch (error) {
        next(error);
    }
}