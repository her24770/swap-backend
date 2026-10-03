import { Request, Response, NextFunction } from "express";
import { darLike, quitarLike } from "../repository/repositorioLikes";
import { buscarPublicacionPorId } from "../repository/repositorioPublicacion";
import { buscarRelacionUsuarioPublicacion } from "../repository/repositorioGuardados";
import { registrarInteraccionPublicacion } from "../autenticacion/eventoRecomendacion";
import { exitoResponse, errorResponse } from "../servicios/Response";

export async function like(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const idPublicacion = Number(req.params.publicacionId);

        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicación no es válido.", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            exitoResponse(res, [], "Publicación no encontrada.", 404);
            return;
        }

        // Verificar que no haya dado like ya
        const relacion = await buscarRelacionUsuarioPublicacion(idUsuario, idPublicacion);
        if (relacion?.is_like) {
            errorResponse(res, "Ya diste like a esta publicación.", 409);
            return;
        }

        const resultado = await darLike(idUsuario, idPublicacion);

        //registrar evento de like
        if(publicacion.id_usuario !== idUsuario) {
            registrarInteraccionPublicacion(idUsuario, idPublicacion, "LIKE_PUBLICACION").catch((error) => {
                console.error(
                    "[Recomendacion] Error registrando like:",
                    error
                );
            });
        }
        exitoResponse(res, resultado, "Like agregado exitosamente.", 200);
    } catch (error) {
        next(error);
    }
}

export async function unlike(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const idPublicacion = Number(req.params.publicacionId);

        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicación no es válido.", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            exitoResponse(res, [], "Publicación no encontrada.", 404);
            return;
        }

        // Verificar que haya dado like previamente
        const relacion = await buscarRelacionUsuarioPublicacion(idUsuario, idPublicacion);
        if (!relacion?.is_like) {
            errorResponse(res, "No has dado like a esta publicación.", 409);
            return;
        }

        const resultado = await quitarLike(idUsuario, idPublicacion);
        exitoResponse(res, resultado, "Like eliminado exitosamente.", 200);
    } catch (error) {
        next(error);
    }
}