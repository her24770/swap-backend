import { Request, Response, NextFunction } from "express";
import { obtenerEstados } from "../repository/repositorioEstado.js";

export async function obtenerTodosLosEstados(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const opt_elegida = req.query.tipo as string | undefined;
        const estados = await obtenerEstados();

        // Verificar si hay estados
        if (!estados || estados.length === 0) {
            res.status(200).json({ message: "No se encontraron estados" });
            return;
        }

        // Mapeo de opciones a sus filtros correspondientes
        const filtros: Record<string, string[]> = {
            publicacion: ["activo", "inactivo"],
            mensaje: ["leido", "enviado"],
            material: ["activo", "inactivo", "reservado", "vendido"],
            acuerdo: ["activo", "cancelado", "atrasado", "completado", "rechazado", "propuesto"]
        };

        // Si no hay opción, devolver todos
        if (!opt_elegida || opt_elegida.trim() === "") {
            res.status(200).json({ message: "Estados obtenidos exitosamente", data: estados });
            return;
        }

        // Obtener los nombres permitidos para la opción elegida
        const nombresPermitidos = filtros[opt_elegida];

        // Si la opción no es válida, devolver error
        if (!nombresPermitidos) {
            res.status(400).json({ message: `Opción '${opt_elegida}' no válida. Opciones disponibles: publicacion, mensaje, material, acuerdo` });
            return;
        }

        // Filtrar estados
        const estadosFiltrados = estados.filter(estado => nombresPermitidos.includes(estado.estado as string));

        res.status(200).json({
            message: "Estados obtenidos exitosamente",
            data: estadosFiltrados
        });

    } catch (error) {
        next(error);
    }
}