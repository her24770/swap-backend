import { Request, Response, NextFunction } from "express";
import { darLike, quitarLike } from "../repository/repositorioLikes";
import { buscarPublicacionPorId } from "../repository/repositorioPublicacion";
import { buscarRelacionUsuarioPublicacion } from "../repository/repositorioGuardados";
import { registrarInteraccionPublicacion } from "../autenticacion/eventoRecomendacion";

export async function like(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const idPublicacion = Number(req.params.publicacionId);

        if (isNaN(idPublicacion)) {
            res.status(400).json({ message: "El ID de la publicación no es válido." });
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            res.status(404).json({ message: "Publicación no encontrada." });
            return;
        }

        // Verificar que no haya dado like ya
        const relacion = await buscarRelacionUsuarioPublicacion(idUsuario, idPublicacion);
        if (relacion?.is_like) {
            res.status(409).json({ message: "Ya diste like a esta publicación." });
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
        res.status(200).json({ message: "Like agregado exitosamente.", data: resultado });
    } catch (error) {
        next(error);
    }
}

export async function unlike(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const idPublicacion = Number(req.params.publicacionId);

        if (isNaN(idPublicacion)) {
            res.status(400).json({ message: "El ID de la publicación no es válido." });
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            res.status(404).json({ message: "Publicación no encontrada." });
            return;
        }

        // Verificar que haya dado like previamente
        const relacion = await buscarRelacionUsuarioPublicacion(idUsuario, idPublicacion);
        if (!relacion?.is_like) {
            res.status(409).json({ message: "No has dado like a esta publicación." });
            return;
        }

        const resultado = await quitarLike(idUsuario, idPublicacion);
        res.status(200).json({ message: "Like eliminado exitosamente.", data: resultado });
    } catch (error) {
        next(error);
    }
}