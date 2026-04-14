import { Request, Response, NextFunction } from "express";
import { buscarPublicacionesPorTipoYUsuario, buscarPublicacionesPaginadas } from "../repository/repositorioPublicacion.js";


export async function obtenerPublicacionesUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);

        if (isNaN(idUsuario)) {
            res.status(400).json({ error: "El id del usuario no es valido" });
            return;
        }

        /*
        //Se obtienen todas las publicaciones de un usuario
        const publicaciones = await buscarPublicacionesPorUsuario(idUsuario);

        Primera forma: Se obtienen todas las publicaciones del usuario y luego se filtran
        //Se filtra en base al id del tipo de perfil con el que fue publicado
        const productos = publicaciones.filter(
            (publicacion) => publicacion.tipo_publicacion.tipo_perfil === "material"
        );
        const servicios = publicaciones.filter(
            (publicacion) => publicacion.tipo_publicacion.tipo_perfil === "tutoria"
        );
        const negocios = publicaciones.filter(
            (publicacion) => publicacion.tipo_publicacion.tipo_perfil === "negocio"
        ); */

        //Segunda forma: Se hacen consultas separadas
        const [productos, servicios, negocios] = await Promise.all([
            buscarPublicacionesPorTipoYUsuario("material", idUsuario),
            buscarPublicacionesPorTipoYUsuario("tutoria", idUsuario),
            buscarPublicacionesPorTipoYUsuario("negocio", idUsuario)
        ]);

        res.status(200).json({ productos, servicios, negocios });
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