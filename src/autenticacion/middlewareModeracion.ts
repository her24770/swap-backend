import { Request, Response, NextFunction } from "express";
import { analizarTexto } from "../servicios/servicioModeracionTexto.js";
import { analizarImagen } from "../servicios/servicioModeracionImagen.js";
import { errorResponse } from "../servicios/Response.js";

// Factory: recibe los campos del body a analizar, retorna el middleware
export function moderarTexto(campos: string[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const texto = campos
            .map(campo => req.body[campo])
            .filter(Boolean)
            .join(' ')
            .trim();

        if (!texto) {
            next();
            return;
        }

        try {
            const resultado = await analizarTexto(texto);
            if (resultado.flagged) {
                errorResponse(res, 'El contenido no cumple con las normas de la comunidad', 422);
                return;
            }
        } catch (error) {
            console.error('[ModeracionTexto] Error al contactar API de moderación:', error);
            errorResponse(res, 'No se pudo verificar el contenido. Inténtalo de nuevo.', 503);
            return;
        }

        next();
    };
}

export async function moderarImagenes(req: Request, res: Response, next: NextFunction): Promise<void> {
    const archivos = req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];
    if (archivos.length === 0) {
        next();
        return;
    }

    try {
        const resultados = await Promise.all(archivos.map(archivo => analizarImagen(archivo.buffer)));
        if (resultados.some(resultado => resultado.flagged)) {
            errorResponse(res, 'El contenido no cumple con las normas de la comunidad', 422);
            return;
        }
        next();
    } catch (error) {
        console.error('[ModeracionImagen] Error al contactar API de moderación:', error);
        errorResponse(res, 'No se pudo verificar el contenido. Inténtalo de nuevo.', 503);
    }
}
