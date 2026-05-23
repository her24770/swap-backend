import { Prisma, Anuncio } from "@prisma/client";
import prisma from "../persistencia/prismaClient";
import { BuscarAnuncios } from "./types";


export async function buscarAnunciosPorUsuario(id_usuario: number): Promise<Anuncio[]> {
    return prisma.anuncio.findMany({
        where: { id_usuario: id_usuario },
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
        orderBy: { fecha_publicacion: 'desc' },
    });
}   


export async function buscarAnuncios(options: BuscarAnuncios): Promise<Anuncio[]> {
    const { limite = 10, order = 'desc', tipo } = options;  
    const orderBy: any = {};
    switch (order) {
        case 'asc':
            orderBy.fecha_publicacion = 'asc';
            break;
        case 'desc':
            orderBy.fecha_publicacion = 'desc';
            break;
        default:
            orderBy.fecha_publicacion = order;
            break;
    }

    const where: any = {};
    if (tipo) {
        const tipoPerfil = await prisma.tipoPerfil.findUnique({
            where: { tipo_perfil: tipo }
        })
        if (tipoPerfil) {
            where.tipo_publicacion = tipoPerfil.id_tipo_perfil;
        }
    }

    return await prisma.anuncio.findMany({
        where,
        include: { imagenes: true, etiquetas: { include: { etiqueta: true } } },
        orderBy,
        take: limite
    });
}   