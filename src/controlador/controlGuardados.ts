import { Request, Response, NextFunction } from "express";
import {
    guardarPublicacion,
    quitarGuardadoPublicacion,
    obtenerGuardadosPorUsuario
} from "../repository/repositorioGuardados";
import { buscarPublicacionPorId } from "../repository/repositorioPublicacion";
import { registrarInteraccionPublicacion } from "../autenticacion/eventoRecomendacion";
import { exitoResponse, errorResponse } from "../servicios/Response";

export async function guardar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const idPublicacion = Number(req.params.publicacionId);

        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicación no es válido.", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            exitoResponse(res, [], "Publicación no encontrada.", 404);
            return;
        }

        const resultado = await guardarPublicacion(idUsuario, idPublicacion);

        //registrar evento de guardado
        if(publicacion.id_usuario !== idUsuario) {
            registrarInteraccionPublicacion(idUsuario, idPublicacion, "GUARDAR_PUBLICACION").catch((error) => {
                console.error(
                    "[Recomendacion] Error registrando guardado:",
                    error
                );
            });
        }
        exitoResponse(res, resultado, "Publicación guardada exitosamente.", 200);
    } catch (error) {
        next(error);
    }
}

export async function quitarGuardado(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const idPublicacion = Number(req.params.publicacionId);

        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicación no es válido.", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            exitoResponse(res, [], "Publicación no encontrada.", 404);
            return;
        }

        const resultado = await quitarGuardadoPublicacion(idUsuario, idPublicacion);
        exitoResponse(res, resultado, "Publicación quitada de guardados.", 200);
    } catch (error) {
        next(error);
    }
}

export async function obtenerGuardados(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const guardados = await obtenerGuardadosPorUsuario(idUsuario);
        
        // Aplanar la relación igual que hace buscarPublicacionesPaginadas
        const data = guardados.map((g: any) => {
            const relacion = g.publicacion.usuarioPublicacions?.[0] ?? null;
            const { usuarioPublicacions, ...restoPublicacion } = g.publicacion;
            return {
                ...g,
                publicacion: {
                    ...restoPublicacion,
                    likeado: relacion?.is_like ?? false,
                    guardado: relacion?.is_save ?? false,
                }
            };
        });
        
        exitoResponse(res, data, "Guardados obtenidos exitosamente.", 200);
    } catch (error) {
        next(error);
    }
}