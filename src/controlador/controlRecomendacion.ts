import { Request, Response, NextFunction } from "express";
import { generarRecomendaciones } from "../servicios/servicioRecomendacion";
import { obtenerTipoPerfilPorNombre } from "../repository/repositorioTipoPerfil";
import { errorResponse, exitoResponse } from "../servicios/Response";

export async function obtenerRecomendacionesGlobales(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {

    try {

        // Tipo opcional
        const tipo = req.params.tipo
            ? (
                Array.isArray(req.params.tipo)
                    ? req.params.tipo[0]
                    : req.params.tipo
            )
            : undefined;

        // Validar tipo si existe
        if (tipo) {
            const tipoPerfil = await obtenerTipoPerfilPorNombre(tipo);
            if (!tipoPerfil) {
                errorResponse(res,"El tipo de publicación no existe",404);
                return;
            }
        }

        // Generar recomendaciones
        const recomendaciones = await generarRecomendaciones(tipo);

        // Sin recomendaciones NO es error
        if (recomendaciones.length === 0) {
            errorResponse(res, "No hay recomendaciones disponibles actualmente", 404);
            return;
        }
        // Respuesta exitosa
        exitoResponse(res, recomendaciones, "Recomendaciones obtenidas exitosamente", 200);

    } catch (error) {
        next(error);
    }
}