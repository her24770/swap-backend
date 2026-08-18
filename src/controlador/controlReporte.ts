import { Request, Response, NextFunction } from "express";
import { schemaCrearReporte, TipoObjetivoReporte } from "../modelo/schemaReporte";
import { buscarPublicacionPorId } from "../repository/repositorioPublicacion";
import { buscarResenaPorId } from "../repository/repositorioResena";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado";
import { actualizarUsuario, buscarUsuarioPorId } from "../repository/repositorioUsuario";
import { guardarReporte, obtenerOCrearMotivoReportePorNombre, buscarReportePorId, buscarReportesPaginados, actualizarEstadoReporte, buscarEstadoReportePorNombre } from "../repository/repositorioReporte";
import { errorResponse, errorValidacionResponse, exitoResponse } from "../servicios/Response.js";

const MAX_LIMIT = 100;

export async function obtenerReportePorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            errorResponse(res, "El id del reporte no es válido", 400);
            return;
        }

        const reporte = await buscarReportePorId(id);
        if (!reporte) {
            errorResponse(res, "Reporte no encontrado", 404);
            return;
        }

        exitoResponse(res, reporte, "Reporte obtenido exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

export async function obtenerReportesPaginados(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const options = req.body;
        
        // Asegurar que el límite no exceda el máximo permitido
        if (options.limit && options.limit > MAX_LIMIT) {
            options.limit = MAX_LIMIT;
        }
        
        const resultado = await buscarReportesPaginados(options);

        exitoResponse(res, {
            reportes: resultado.reportes,
            total: resultado.total,
            page: resultado.page,
            limit: resultado.limit,
            totalPages: resultado.totalPages
        }, "Reportes obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

async function resolverIdReceptor(tipoObjetivo: TipoObjetivoReporte, idObjetivo: number): Promise<number | null> {
    if (tipoObjetivo === "usuario") {
        const usuario = await buscarUsuarioPorId(idObjetivo);
        return usuario?.id_usuario ?? null;
    }

    if (tipoObjetivo === "publicacion") {
        const publicacion = await buscarPublicacionPorId(idObjetivo);
        return publicacion?.id_usuario ?? null;
    }

    const resena = await buscarResenaPorId(idObjetivo);
    return resena?.id_emisor ?? null;
}

function construirObservaciones(tipoObjetivo: TipoObjetivoReporte, idObjetivo: number, motivo: string, detalle: string): string {
    const detalleNormalizado = detalle.trim() || "Sin detalle adicional.";
    return [
        `Objetivo: ${tipoObjetivo} #${idObjetivo}`,
        `Motivo: ${motivo}`,
        `Detalle: ${detalleNormalizado}`,
    ].join("\n");
}

export async function registrarNuevoReporte(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idEmisor = Number(req.usuario?.sub);
        if (!idEmisor || isNaN(idEmisor)) {
            errorResponse(res, "Usuario no autenticado.", 401);
            return;
        }

        const validacion = schemaCrearReporte.safeParse(req.body);
        if (!validacion.success) {
            errorValidacionResponse(res, validacion.error.errors);
            return;
        }

        const { tipo_objetivo: tipoObjetivo, id_objetivo: idObjetivo, motivo, detalle } = validacion.data;
        const idReceptor = await resolverIdReceptor(tipoObjetivo, idObjetivo);

        if (!idReceptor) {
            errorResponse(res, "El elemento que intentas reportar no existe.", 404);
            return;
        }

        if (idEmisor === idReceptor) {
            errorResponse(res, "No puedes reportar contenido propio.", 400);
            return;
        }

        const estadoPendiente = await obtenerEstadoPorNombre("pendiente");
        if (!estadoPendiente) {
            errorResponse(res, "No existe el estado pendiente para registrar reportes.", 500);
            return;
        }

        const motivoReporte = await obtenerOCrearMotivoReportePorNombre(motivo);
        const nuevoReporte = await guardarReporte({
            emisor: { connect: { id_usuario: idEmisor } },
            receptor: { connect: { id_usuario: idReceptor } },
            motivoRel: { connect: { id_motivo: motivoReporte.id_motivo } },
            estadoRel: { connect: { id_estado: estadoPendiente.id_estado } },
            observaciones: construirObservaciones(tipoObjetivo, idObjetivo, motivo, detalle),
            fecha: new Date(),
        });

        await actualizarUsuario(idReceptor, {
            reportes_recibidos: { increment: 1 },
        });

        exitoResponse(res, nuevoReporte, "Reporte enviado exitosamente.", 201);
    } catch (error) {
        next(error);
    }
}
