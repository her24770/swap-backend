import { Request, Response, NextFunction } from "express";
import {
    guardarPublicacion,
    quitarGuardadoPublicacion,
    obtenerGuardadosPorUsuario
} from "../repository/repositorioGuardados";
import { buscarPublicacionPorId } from "../repository/repositorioPublicacion";
import { registrarInteraccionPublicacion } from "../autenticacion/eventoRecomendacion";

export async function guardar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const idPublicacion = Number(req.params.publicacionId);

        if (isNaN(idPublicacion)) {
            res.status(400).json({ message: "El ID de la publicación no es válido." });
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            res.status(404).json({ message: "Publicación no encontrada." });
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
        res.status(200).json({ message: "Publicación guardada exitosamente.", data: resultado });
    } catch (error) {
        next(error);
    }
}

export async function quitarGuardado(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const idPublicacion = Number(req.params.publicacionId);

        if (isNaN(idPublicacion)) {
            res.status(400).json({ message: "El ID de la publicación no es válido." });
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            res.status(404).json({ message: "Publicación no encontrada." });
            return;
        }

        const resultado = await quitarGuardadoPublicacion(idUsuario, idPublicacion);
        res.status(200).json({ message: "Publicación quitada de guardados.", data: resultado });
    } catch (error) {
        next(error);
    }
}

export async function obtenerGuardados(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const guardados = await obtenerGuardadosPorUsuario(idUsuario);
        
        // Aplanar la relación igual que hace buscarPublicacionesPaginadas
        const data = guardados.map((g) => {
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
        
        res.status(200).json({ message: "Guardados obtenidos exitosamente.", data });
    } catch (error) {
        next(error);
    }
}