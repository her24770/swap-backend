import { Request, Response, NextFunction } from "express";
import { obtenerAcuerdosPorUsuario } from "../repository/repositorioAcuerdo";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

// Interfaz para la agrupación de acuerdos en base a la publicacion y el usuario que la obtiene
interface AcuerdoAgrupado {
    id_publicacion: number;
    id_usuario: number;
    publicacion: any;
    usuario: any;
    acuerdos: {
        id_acuerdo: number;
        fecha_entrega: Date;
        lugar_entrega: string;
        observaciones: string;
        estado: any;
        id_conversacion: number;
    }[];
}

const TIPOS_HISTORIAL_VALIDOS = ["producto", "material", "negocio", "tutoria"];
const ESTADOS_VALIDOS = ["activo", "pendiente", "completado", "cancelado"];

function parsePositiveInt(value: unknown): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return undefined;
    return parsed;
}

// Función auxiliar de agrupamiento de acuerdos en base a la publicacion y el usuario que la obtiene
function agruparAcuerdos(acuerdos: any[]): AcuerdoAgrupado[] {
    const grupos = new Map<string, AcuerdoAgrupado>();

    for (const acuerdo of acuerdos) {
        const key = `${acuerdo.id_publicacion}-${acuerdo.id_usuario}`;

        let grupo = grupos.get(key);

        if (!grupo) {
            grupo = {
                id_publicacion: acuerdo.id_publicacion,
                id_usuario: acuerdo.id_usuario,
                publicacion: acuerdo.publicacion,
                usuario: acuerdo.publicacion.usuario,
                acuerdos: []
            };

            grupos.set(key, grupo);
        }

        grupo.acuerdos.push({
            id_acuerdo: acuerdo.id_acuerdo,
            fecha_entrega: acuerdo.fecha_entrega,
            lugar_entrega: acuerdo.lugar_entrega,
            observaciones: acuerdo.observaciones,
            estado: acuerdo.estadoRel,
            id_conversacion: acuerdo.id_conversacion
        });
    }

    return Array.from(grupos.values());
}

export async function obtenerAcuerdosUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        const tipo = req.query.tipo as string | undefined;
        const estado = req.query.estado as string | undefined;
        const q = req.query.q as string | undefined;
        const agrupados = req.query.agrupados === "true";
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
        //checar si el estado es valido
        if (estado && !ESTADOS_VALIDOS.includes(estado.toLowerCase())) {
            errorResponse(res, "El estado no es valido", 400);
            return;
        }
        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "El usuario no existe", 404);
            return;
        }
        const resultado = await obtenerAcuerdosPorUsuario(idUsuario, { tipo, page, limit, q, estado });
        const acuerdos = agrupados ? agruparAcuerdos(resultado.acuerdos) : resultado.acuerdos; 
        const data =
            page !== undefined && limit !== undefined
                ? { data: acuerdos, total: resultado.total, page, limit }
                : acuerdos;

        exitoResponse(res, data, "Acuerdos obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}
