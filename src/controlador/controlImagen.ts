import { Request, Response, NextFunction } from "express";
import { subirImagenR2, eliminarImagenR2, construirUrlR2 } from "../servicios/servicioR2.js";
import { buscarUsuarioPorId, actualizarUsuario } from "../repository/repositorioUsuario.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";
import { analizarImagen } from "../servicios/servicioModeracionImagen.js";
import { crearNotificacion } from "../repository/repositorioNotificacion.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";

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

        // Moderación en background
        const buffer = req.file.buffer;
        moderarFotoPerfilEnBackground(idUsuario, url, buffer).catch(() => {});
    } catch (error) {
        next(error);
    }
}

async function moderarFotoPerfilEnBackground(
    idUsuario: number,
    url: string,
    buffer: Buffer
): Promise<void> {
    const resultado = await analizarImagen(buffer).catch(() => null);
    if (!resultado?.flagged) return;

    try { await eliminarImagenR2(url); } catch { /* continúa si falla R2 */ }

    const urlDefault = construirUrlR2('perfil', 'default', 'png');
    await actualizarUsuario(idUsuario, { url_foto_perfil: urlDefault });

    const estadoEnviado = await obtenerEstadoPorNombre('enviado');
    if (estadoEnviado) {
        await crearNotificacion(
            idUsuario,
            'Tu foto de perfil fue eliminada por no cumplir con las normas de la comunidad.',
            estadoEnviado.id_estado
        );
    }
}

