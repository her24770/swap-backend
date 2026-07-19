import { Request, Response, NextFunction } from "express";
import { obtenerAcuerdosPorUsuario } from "../repository/repositorioAcuerdo";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario";
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
        const resultado = await obtenerAcuerdosPorUsuario(idUsuario, { tipo, page, limit });
        const data =
            page !== undefined && limit !== undefined
                ? { data: resultado.acuerdos, total: resultado.total, page, limit }
                : resultado.acuerdos;

        exitoResponse(res, data, "Acuerdos obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}
