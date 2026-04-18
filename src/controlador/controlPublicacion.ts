import { Request, Response, NextFunction } from "express";
import { buscarPublicacionesPorTipoYUsuario, buscarPublicacionesPaginadas } from "../repository/repositorioPublicacion.js";
import { obtenerTipoPerfilPorNombre } from "../repository/repositorioTipoPerfil.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";


export async function obtenerPublicacionesUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        const tipo = req.query.tipo as string;

        if (isNaN(idUsuario)) {
            res.status(400).json({ error: "El id del usuario no es valido" });
            return;
        }
        if (!tipo) {
            res.status(400).json({ error: "El tipo de publicacion es requerido para obtener las publicaciones" });
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            res.status(404).json({ error: "El usuario no existe" });
            return;
        }

        const tipoPerfil = await obtenerTipoPerfilPorNombre(tipo);
        if (!tipoPerfil) {
            res.status(404).json({ error: "El tipo de publicacion no existe" });
            return;
        }

        const publicaciones = await buscarPublicacionesPorTipoYUsuario(tipo, idUsuario);

        res.status(200).json({ message: "Publicaciones obtenidas exitosamente", data: publicaciones });
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerTodasLasPublicaciones(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 10);
        const sort = req.query.sort as string || 'fecha';
        const order = req.query.order as string === 'asc' ? 'asc' : 'desc';
        const tipo = req.query.tipo as string;

        const sortsValidos = ['fecha', 'me_gusta', 'precio'];
        if (sort && !sortsValidos.includes(sort)) {
            res.status(400).json({
                error: "El parámetro sort debe ser uno de los siguientes: fecha, me_gusta, precio"
            });
            return;
        }
        const tipoPerfil = await obtenerTipoPerfilPorNombre(tipo);
        if (!tipoPerfil) {
            res.status(404).json({ error: "El tipo de publicacion no existe" });
            return;
        }

        const resultado = await buscarPublicacionesPaginadas({
            page,
            limit,
            sort: sort as any,
            order,
            tipo
        });

        if (!resultado || resultado.length == 0) {
            res.status(404).json({ error: "No se encontraron publicaciones" });
            return;
        }

        res.status(200).json({ message: "Publicaciones obtenidas exitosamente", data: resultado });
        return;
    } catch (error) {
        next(error);
    }
}