import { Request, Response, NextFunction } from "express";
import { obtenerAcuerdosPorUsuario, obtenerAcuerdosPorConversacion } from "../repository/repositorioAcuerdo";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario";
import { buscarConversacionPorId } from "../repository/repositorioMensaje";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

const TIPOS_HISTORIAL_VALIDOS = ["producto", "material", "negocio", "tutoria"];

function parsePositiveInt(value: unknown): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return undefined;
    return parsed;
}

export async function obtenerAcuerdosUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        const tipo = req.query.tipo as string | undefined;
        const q = req.query.q as string | undefined;
        const page = parsePositiveInt(req.query.page);
        const limit = parsePositiveInt(req.query.limit);
        if (isNaN(idUsuario)) {
            errorResponse(res, "El id del usuario no es valido", 400);
            return;
        }
        if ((req.query.page !== undefined && page === undefined) || (req.query.limit !== undefined && limit === undefined)) {
            errorResponse(res, "Los parametros page y limit deben ser enteros positivos", 400);
            return;
        }
        if (tipo && !TIPOS_HISTORIAL_VALIDOS.includes(tipo.toLowerCase())) {
            errorResponse(res, "El tipo de historial no es valido", 400);
            return;
        }
        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "El usuario no existe", 404);
            return;
        }
        const resultado = await obtenerAcuerdosPorUsuario(idUsuario, { tipo, page, limit, q });
        const data =
            page !== undefined && limit !== undefined
                ? { data: resultado.acuerdos, total: resultado.total, page, limit }
                : resultado.acuerdos;

        exitoResponse(res, data, "Acuerdos obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

/*
    Obtener los acuerdos asociados a una conversacion.
    Solo los participantes de la conversacion pueden consultarlos.
*/
export async function obtenerAcuerdosConversacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idConversacion = Number(req.params.id);
        const idUsuario = Number(req.usuario?.sub);

        if (isNaN(idConversacion)) {
            errorResponse(res, "El id de la conversacion no es valido", 400);
            return;
        }

        const conversacion = await buscarConversacionPorId(idConversacion);
        if (!conversacion) {
            errorResponse(res, "La conversacion no existe", 404);
            return;
        }

        const esParticipante = conversacion.id_usuario_1 === idUsuario || conversacion.id_usuario_2 === idUsuario;
        if (!esParticipante) {
            errorResponse(res, "No tienes permiso para ver los acuerdos de esta conversacion", 403);
            return;
        }

        const acuerdos = await obtenerAcuerdosPorConversacion(idConversacion);
        exitoResponse(res, acuerdos, "Acuerdos de la conversacion obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}