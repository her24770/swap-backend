import { Request, Response, NextFunction } from "express";
import { buscarUsuariosModeracion } from "../repository/repositorioUsuario.js";
import { schemaFiltrosModeracionUsuario } from "../modelo/schemaModeracionUsuario.js";
import { errorValidacionResponse, exitoResponse } from "../servicios/Response.js";

// GET /api/moderador/usuarios
export async function listarUsuariosModeracion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parseo = schemaFiltrosModeracionUsuario.safeParse(req.query);
        if (!parseo.success) {
            errorValidacionResponse(res, parseo.error.errors, "Filtros inválidos.");
            return;
        }

        const resultado = await buscarUsuariosModeracion(parseo.data);

        exitoResponse(res, {
            usuarios: resultado.usuarios,
            total: resultado.total,
            page: parseo.data.page,
            limit: parseo.data.limit,
        }, "Usuarios obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}