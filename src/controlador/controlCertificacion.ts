import { Request, Response, NextFunction } from "express";
import { schemaCrearCertificacion } from "../modelo/schemaCertificacion.js";
import {
    crearCertificacion,
    eliminarCertificacion,
    buscarCertificacionesPorUsuario,
    buscarCertificacionPorId,
    contarCertificacionesPorUsuario,
} from "../repository/repositorioCertificacion.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";
import { verificarEtiquetasExisten } from "../repository/repositorioEtiqueta.js";
import { subirImagenR2, eliminarImagenR2 } from "../servicios/servicioR2.js";
import { errorResponse, exitoResponse, errorValidacionResponse } from "../servicios/Response.js";

const LIMITE_CERTIFICACIONES = 5;

export async function obtenerCertificacionesDeUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id_usuario = Number(req.params.id_usuario);

        if (isNaN(id_usuario)) {
            errorResponse(res, "El ID del usuario no es válido.", 400);
            return;
        }

        const usuario = await buscarUsuarioPorId(id_usuario);
        if (!usuario) {
            errorResponse(res, "El usuario no existe.", 404);
            return;
        }

        const certificaciones = await buscarCertificacionesPorUsuario(id_usuario);
        exitoResponse(res, certificaciones, "Certificaciones obtenidas exitosamente.", 200);
    } catch (error) {
        next(error);
    }
}

export async function obtenerCertificacionPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id_certificacion = Number(req.params.id);

        if (isNaN(id_certificacion)) {
            errorResponse(res, "El ID de la certificación no es válido.", 400);
            return;
        }

        const certificacion = await buscarCertificacionPorId(id_certificacion);
        if (!certificacion) {
            errorResponse(res, "Certificación no encontrada.", 404);
            return;
        }

        exitoResponse(res, certificacion, "Certificación obtenida exitosamente.", 200);
    } catch (error) {
        next(error);
    }
}

export async function crearCertificacionUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const bodyData = {
            nombre: req.body.nombre,
            lugar_emision: req.body.lugar_emision,
            id_etiqueta: Number(req.body.id_etiqueta),
        };

        const validacion = schemaCrearCertificacion.safeParse(bodyData);
        if (!validacion.success) {
            errorValidacionResponse(res, validacion.error.errors);
            return;
        }

        if (!req.file) {
            errorResponse(res, "El archivo PDF es obligatorio.", 400);
            return;
        }

        const idUsuario = Number(req.usuario?.sub);
        if (!idUsuario) {
            errorResponse(res, "Usuario no autenticado.", 401);
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "Usuario no encontrado.", 404);
            return;
        }

        const etiquetaExiste = await verificarEtiquetasExisten([validacion.data.id_etiqueta]);
        if (!etiquetaExiste) {
            errorResponse(res, "La etiqueta especificada no existe.", 404);
            return;
        }

        const total = await contarCertificacionesPorUsuario(idUsuario);
        if (total >= LIMITE_CERTIFICACIONES) {
            errorResponse(res, `Has alcanzado el límite de ${LIMITE_CERTIFICACIONES} certificaciones.`, 400);
            return;
        }

        const rutaPdf = await subirImagenR2(
            req.file.buffer,
            req.file.mimetype,
            "certificaciones",
            `cert_${idUsuario}_${Date.now()}`
        );

        const certificacion = await crearCertificacion({
            id_usuario: idUsuario,
            nombre: validacion.data.nombre,
            ruta_pdf: rutaPdf,
            lugar_emision: validacion.data.lugar_emision,
            id_etiqueta: validacion.data.id_etiqueta,
        });

        exitoResponse(res, certificacion, "Certificación creada exitosamente.", 201);
    } catch (error) {
        next(error);
    }
}

export async function eliminarCertificacionUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id_certificacion = Number(req.params.id);
        const idUsuario = Number(req.usuario?.sub);

        if (isNaN(id_certificacion)) {
            errorResponse(res, "El ID de la certificación no es válido.", 400);
            return;
        }

        const certificacion = await buscarCertificacionPorId(id_certificacion);
        if (!certificacion) {
            errorResponse(res, "Certificación no encontrada.", 404);
            return;
        }

        if (certificacion.id_usuario !== idUsuario) {
            errorResponse(res, "No tienes permiso para eliminar esta certificación.", 403);
            return;
        }

        try {
            await eliminarImagenR2(certificacion.ruta_pdf);
        } catch {
            // Si falla R2 se continúa para que la BD quede limpia
        }

        await eliminarCertificacion(id_certificacion);
        exitoResponse(res, {}, "Certificación eliminada exitosamente.", 200);
    } catch (error) {
        next(error);
    }
}
