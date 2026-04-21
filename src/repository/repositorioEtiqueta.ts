import { Etiqueta } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

/*
    Obtener etiquetas de un usuario
*/
export async function obtenerEtiquetasPorUsuario(idUsuario: number, includePadre: boolean = false): Promise<Etiqueta[] | []> {
    return await prisma.etiqueta.findMany({
        where:
            { usuarios: { some: { id_usuario: idUsuario } } },
        include: { padre: includePadre },
        orderBy: { nombre: "asc" }
    });
}

