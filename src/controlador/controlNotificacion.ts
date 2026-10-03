import { Request, Response, NextFunction } from "express";
import {
    obtenerNotificacionesPorUsuario,
    obtenerNotificacionPorId,
    actualizarEstadoNotificacion,
} from "../repository/repositorioNotificacion.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

export async function listarNotificaciones(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const notificaciones = await obtenerNotificacionesPorUsuario(idUsuario);
        exitoResponse(res, notificaciones, "Notificaciones obtenidas", 200);
    } catch (error) {
        next(error);
    }
}

export async function cambiarEstadoNotificacion(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idNotificacion = Number(req.params.id);
        const { estado } = req.body;

        if (!estado || !['leido', 'enviado'].includes(estado)) {
            errorResponse(res, "Estado inválido. Use 'leido' o 'enviado'", 400);
            return;
        }

        const notificacion = await obtenerNotificacionPorId(idNotificacion);
        if (!notificacion) {
            errorResponse(res, "Notificación no encontrada", 404);
            return;
        }

        const idUsuario = Number(req.usuario?.sub);
        if (notificacion.id_usuario !== idUsuario) {
            errorResponse(res, "No tienes permiso para modificar esta notificación", 403);
            return;
        }

        const estadoObj = await obtenerEstadoPorNombre(estado);
        if (!estadoObj) {
            errorResponse(res, "Estado no encontrado en el sistema", 500);
            return;
        }

        const actualizada = await actualizarEstadoNotificacion(idNotificacion, estadoObj.id_estado);
        exitoResponse(res, actualizada, "Estado de notificación actualizado", 200);
    } catch (error) {
        next(error);
    }
}
