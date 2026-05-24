import { Prisma, Anuncio } from "@prisma/client";
import prisma from "../persistencia/prismaClient";
import { BuscarAnuncios } from "./types";


export async function buscarAnunciosPorUsuario(id_usuario: number): Promise<Anuncio[]> {
    return prisma.anuncio.findMany({
        where: { id_usuario: id_usuario },
    });
}

export async function buscarAnuncioPorId(id_anuncio: number): Promise<Anuncio | null> {
    return prisma.anuncio.findUnique({
        where: { id_anuncio },
    });
}   

export async function crearAnuncio(data: Prisma.AnuncioCreateInput): Promise<Anuncio> {
    return prisma.anuncio.create({ data });

}

export async function actualizarAnuncio(id: number, data: Prisma.AnuncioUpdateInput): Promise<Anuncio> {
    return prisma.anuncio.update({ where: { id_anuncio: id }, data });
}

export async function eliminarAnuncio(id: number): Promise<Anuncio> {
    return prisma.anuncio.delete({ where: { id_anuncio: id } });
}


export async function buscarTodosLosAnuncios(): Promise<Anuncio[]> {
    return prisma.anuncio.findMany({
        orderBy: { fecha_anuncio: 'desc' },
    });
}   


export async function buscarAnuncios(options: BuscarAnuncios): Promise<Anuncio[]> {
    // valores default
    const { limit = 10, order = 'desc' } = options;  

    const orderBy: any = {};
    switch (order) {
        case 'asc':
            orderBy.fecha_anuncio = 'asc';
            break;
        case 'desc':
            orderBy.fecha_anuncio = 'desc';
            break;
        default:
            orderBy.fecha_anuncio = order;
            break;
    }

    return await prisma.anuncio.findMany({
        orderBy,
        take: limit
    });
}   