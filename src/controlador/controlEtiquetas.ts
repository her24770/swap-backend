import { Request, Response, NextFunction } from "express";
import { obtenerEtiquetasPorUsuario } from "../repository/repositorioEtiqueta";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario";
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
            exitoResponse(res, etiquetas, "No se encontraron etiquetas", 200);
            return;
        }
        exitoResponse(res, etiquetas, "Etiquetas obtenidas exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}