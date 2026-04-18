import { Request, Response, NextFunction } from "express";
import { obtenerAcuerdosPorUsuario } from "../repository/repositorioAcuerdo";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario";

export async function obtenerAcuerdosUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        if (isNaN(idUsuario)) {
            res.status(400).json({ error: "El id del usuario no es valido" });
            return;
        }
        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            res.status(404).json({ error: "El usuario no existe" });
            return;
        }
        const acuerdos = await obtenerAcuerdosPorUsuario(idUsuario);
        res.status(200).json({ message: "Acuerdos obtenidos exitosamente", data: acuerdos });
    } catch (error) {
        next(error);
    }
}