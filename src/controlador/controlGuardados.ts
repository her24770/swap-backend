import { Request, Response, NextFunction } from "express";
import {
    guardarPublicacion,
    quitarGuardadoPublicacion,
    obtenerGuardadosPorUsuario
} from "../repository/repositorioGuardados";
import { buscarPublicacionPorId } from "../repository/repositorioPublicacion";

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
        res.status(200).json({ message: "Guardados obtenidos exitosamente.", data: guardados });
    } catch (error) {
        next(error);
    }
}