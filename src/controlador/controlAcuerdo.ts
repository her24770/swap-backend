import { Request, Response, NextFunction } from "express";
import { obtenerAcuerdosPorUsuario } from "../repository/repositorioAcuerdo";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

export async function obtenerAcuerdosUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        if (isNaN(idUsuario)) {
            errorResponse(res, "El id del usuario no es valido", 400);
            return;
        }
        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "El usuario no existe", 404);
            return;
        }
        const acuerdos = await obtenerAcuerdosPorUsuario(idUsuario);
        exitoResponse(res, acuerdos, "Acuerdos obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}