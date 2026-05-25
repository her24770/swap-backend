import { Request, Response, NextFunction } from "express";
import { analizarTexto } from "../servicios/servicioModeracionTexto.js";
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
            // fail-open: si OpenAI no responde se loggea pero no se bloquea al usuario
            console.error('[ModeracionTexto] Error al contactar API de moderación:', error);
        }

        next();
    };
}
