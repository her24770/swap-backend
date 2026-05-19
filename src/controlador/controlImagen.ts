import { Request, Response, NextFunction } from "express";
import { subirImagenR2, eliminarImagenR2, imagenExisteR2, construirUrlR2 } from "../servicios/servicioR2.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

export async function subirImagen(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (!req.file) {
            errorResponse(res, "No se recibio ninguna imagen", 400);
            return;
        }

        const carpeta = (req.query.carpeta as string) || "general";
        const url = await subirImagenR2(req.file.buffer, req.file.mimetype, carpeta);

        exitoResponse(res, url, "Imagen subida exitosamente", 201);
    } catch (error) {
        next(error);
    }
}

export async function subirFotoPerfil(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (!req.file) {
            errorResponse(res, "No se recibio ninguna imagen", 400);
            return;
        }

        const idUsuario = Number(req.params.id);
        const carpeta = "perfil";

        // Obtener la URL actual del perfil desde BD para borrar la imagen real (sin adivinar extensión)
        const usuario = await buscarUsuarioPorId(idUsuario);
        const urlAnterior = usuario?.url_foto_perfil ?? null;

        if (urlAnterior) {
            try {
                await eliminarImagenR2(urlAnterior);
            } catch {
                // Si falla la eliminación en R2 se continúa de todas formas
            }
        }

        const url = await subirImagenR2(req.file.buffer, req.file.mimetype, carpeta, `user_${idUsuario}`);

        exitoResponse(res, url, urlAnterior ? "Foto de perfil actualizada" : "Foto de perfil agregada", 201);
    } catch (error) {
        next(error);
    }
}

export async function subirFotoPublicacion(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (!req.file) {
            errorResponse(res, "No se recibio ninguna imagen", 400);
            return;
        }

        const idPublicacion = req.params.id;
        const ext = req.file.mimetype.split("/")[1];
        const carpeta = "publicaciones";

        // Validar si existe imagen anterior
        const existe = await imagenExisteR2(carpeta, `post_${idPublicacion}`, ext);

        if (existe) {
            const urlAnterior = construirUrlR2(carpeta, `post_${idPublicacion}`, ext);
            await eliminarImagenR2(urlAnterior);
        }

        const url = await subirImagenR2(req.file.buffer, req.file.mimetype, carpeta, `post_${idPublicacion}`);

        exitoResponse(res, url, existe ? "Imagen de publicacion actualizada" : "Imagen de publicacion agregada", 201);
    } catch (error) {
        next(error);
    }
}
