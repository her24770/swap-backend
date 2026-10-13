import { Request, Response, NextFunction } from "express";
import { analizarTexto } from "../servicios/servicioModeracionTexto.js";
import { analizarImagen } from "../servicios/servicioModeracionImagen.js";
import { errorResponse } from "../servicios/Response.js";
import { escribirLog } from "../observabilidad/logger.js";

// Extensión de tipos de Request para moderación sin modificar otros archivos del sistema
declare global {
    namespace Express {
        interface Request {
            moderacionPendiente?: boolean;
            motivoModeracionPendiente?: string;
        }
    }
}

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
            // Si el contenido viola explícitamente las normas, se rechaza de inmediato (422)
            if (resultado.flagged) {
                errorResponse(res, 'El contenido no cumple con las normas de la comunidad', 422);
                return;
            }
        } catch (error) {
            // OWASP Top 10 A10: Política Fail-Closed ante caída o indisponibilidad del proveedor.
            // En vez de rechazar con 503 o publicar directamente sin moderar, se registra el evento
            // y se delega la publicación a estado 'pendiente' para posterior revisión manual del moderador.
            escribirLog("warn", "moderation.provider_failed", {
                requestId: req.requestId,
                providerType: "text",
                route: req.originalUrl,
                error,
            });

            req.moderacionPendiente = true;
            req.motivoModeracionPendiente = "Fallo o indisponibilidad en proveedor de moderación de texto (OpenAI)";
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
        // Si alguna imagen infringe las normas, rechazo inmediato
        if (resultados.some(resultado => resultado.flagged)) {
            errorResponse(res, 'El contenido no cumple con las normas de la comunidad', 422);
            return;
        }
        next();
    } catch (error) {
        // OWASP Top 10 A10: Política Fail-Closed ante fallo en análisis de imágenes (AWS Rekognition).
        // Se registra el evento operativo y se enruta la publicación a revisión manual.
        escribirLog("warn", "moderation.provider_failed", {
            requestId: req.requestId,
            providerType: "image",
            route: req.originalUrl,
            error,
        });

        req.moderacionPendiente = true;
        req.motivoModeracionPendiente = "Fallo o indisponibilidad en proveedor de moderación de imágenes (AWS Rekognition)";
        next();
    }
}
