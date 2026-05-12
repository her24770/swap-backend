import { Etiqueta } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

export async function obtenerEtiquetasPorUsuario(idUsuario: number, includePadre: boolean = false): Promise<Etiqueta[] | []> {
    return await prisma.etiqueta.findMany({
        where:
            { usuarios: { some: { id_usuario: idUsuario } } },
        include: { padre: includePadre },
        orderBy: { nombre: "asc" }
    });
}

export async function obtenerTodasLasEtiquetas(): Promise<Etiqueta[]> {
    return await prisma.etiqueta.findMany({
        orderBy: { nombre: "asc" }
    });
}

