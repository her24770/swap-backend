import { Request, Response, NextFunction } from "express";
import { obtenerEtiquetasPorUsuario } from "../repository/repositorioEtiqueta";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario";

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