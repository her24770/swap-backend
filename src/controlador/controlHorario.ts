import { Request, Response, NextFunction } from "express";
import {
    buscarHorariosPorUsuario,
    reemplazarHorariosUsuario,
} from "../repository/repositorioHorario.js";
import type { DiaSemana, HorarioPersistido } from "../repository/repositorioHorario.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";
import type { ActualizarHorarioInput } from "../modelo/schemaDisponibilidad.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

export async function obtenerHorarioUsuario(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idUsuario = Number(req.params.usuarioId);

        if (isNaN(idUsuario)) {
            errorResponse(res, "El id del usuario no es válido", 400);
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }

        const horarios = await buscarHorariosPorUsuario(idUsuario);
        exitoResponse(res, horarios.map(mapHorarioResponse), "Horario obtenido exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

export async function actualizarHorarioUsuario(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idUsuario = Number(req.params.usuarioId);

        if (isNaN(idUsuario)) {
            errorResponse(res, "El id del usuario no es válido", 400);
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }

        const { bloques } = req.body as ActualizarHorarioInput;
        const horarios = await reemplazarHorariosUsuario(
            idUsuario,
            bloques.map((bloque) => ({
                dia: bloque.dia as DiaSemana,
                hora_inicio: bloque.hora_inicio,
                hora_fin: bloque.hora_fin,
            }))
        );

        exitoResponse(res, horarios.map(mapHorarioResponse), "Horario actualizado correctamente", 200);
    } catch (error) {
        next(error);
    }
}

function mapHorarioResponse(horario: HorarioPersistido): Record<string, unknown> {
    return {
        id_tiempo: horario.id_tiempo,
        id_usuario: horario.id_usuario,
        dia: horario.dia,
        hora_inicio: formatHora(horario.hora_inicio),
        hora_fin: formatHora(horario.hora_fin),
        estado: horario.estado ?? "disponible",
    };
}

function formatHora(fecha: Date | string): string {
    if (typeof fecha === "string") {
        return fecha.slice(0, 5);
    }

    return `${String(fecha.getUTCHours()).padStart(2, "0")}:${String(fecha.getUTCMinutes()).padStart(2, "0")}`;
}
