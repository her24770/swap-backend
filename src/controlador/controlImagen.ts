import { Request, Response, NextFunction } from "express";
import { subirImagenR2, eliminarImagenR2, imagenExisteR2, construirUrlR2 } from "../servicios/servicioR2.js";

export async function subirImagen(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (!req.file) {
            res.status(400).json({ message: "No se recibió ninguna imagen." });
            return;
        }

        const carpeta = (req.query.carpeta as string) || "general";
        const url = await subirImagenR2(req.file.buffer, req.file.mimetype, carpeta);

        res.status(201).json({ url });
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
            res.status(400).json({ message: "No se recibió ninguna imagen." });
            return;
        }

        const idUsuario = req.params.id;
        const ext = req.file.mimetype.split("/")[1];
        const carpeta = "perfil";

        // Validar si existe imagen anterior
        const existe = await imagenExisteR2(carpeta, `user_${idUsuario}`, ext);

        if (existe) {
            const urlAnterior = construirUrlR2(carpeta, `user_${idUsuario}`, ext);
            await eliminarImagenR2(urlAnterior);
        }

        const url = await subirImagenR2(req.file.buffer, req.file.mimetype, carpeta, `user_${idUsuario}`);

        res.status(201).json({
            message: existe ? "Foto de perfil actualizada." : "Foto de perfil agregada.",
            url
        });
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
            res.status(400).json({ message: "No se recibió ninguna imagen." });
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

        res.status(201).json({
            message: existe ? "Imagen de publicación actualizada." : "Imagen de publicación agregada.",
            url
        });
    } catch (error) {
        next(error);
    }
}
