import { Request, Response, NextFunction } from "express";
import { obtenerEtiquetasPorUsuario, obtenerEtiquetasPorPublicacion, obtenerTodasLasEtiquetas } from "../repository/repositorioEtiqueta";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario";
import { buscarPublicacionPorId } from "../repository/repositorioPublicacion";

export async function obtenerEtiquetasUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        const includePadre = req.query.padres === "true"; //Incluir la etiqueta padre

        if (isNaN(idUsuario)) {
            res.status(400).json({ error: "El id del usuario no es valido" });
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            res.status(404).json({ error: "El usuario no existe" });
            return;
        }

        const etiquetas = await obtenerEtiquetasPorUsuario(idUsuario, includePadre);
        res.status(200).json({ message: etiquetas.length === 0 ? "No se encontraron etiquetas" : "Etiquetas obtenidas exitosamente", data: etiquetas });
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerEtiquetasPublicacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        const includePadre = req.query.padres === "true"; //Incluir la etiqueta padre

        if (isNaN(idPublicacion)) {
            res.status(400).json({ error: "El id de la publicacion no es valido" });
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            res.status(404).json({ message: "La publicacion no existe" });
            return;
        }

        const etiquetas = await obtenerEtiquetasPorPublicacion(idPublicacion, includePadre);
        res.status(200).json({ message: etiquetas.length === 0 ? "No se encontraron etiquetas" : "Etiquetas obtenidas exitosamente", data: etiquetas });
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerEtiquetas(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const etiquetas = await obtenerTodasLasEtiquetas();
        res.status(200).json({ message: "Etiquetas obtenidas exitosamente", data: etiquetas });
    } catch (error) {
        next(error);
    }
}