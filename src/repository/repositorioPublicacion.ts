import { Prisma, Publicacion, ImagenPublicacion, Etiqueta } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

// ─────────────────────────────────────────────
// Publicacion
// ─────────────────────────────────────────────

export async function buscarPublicacionPorId(id: number): Promise<Publicacion | null> {
    return prisma.publicacion.findUnique({
        where: { id_publicacion: id },
        include: { imagenes: true, etiquetas: { include: { etiqueta: true } } },
    });
}

export async function buscarTodasLasPublicaciones(): Promise<Publicacion[]> {
    return prisma.publicacion.findMany({
        include: { imagenes: true, etiquetas: { include: { etiqueta: true } } },
        orderBy: { fecha_publicacion: "desc" },
    });
}

export async function buscarPublicacionesPorUsuario(idUsuario: number): Promise<Publicacion[]> {
    return prisma.publicacion.findMany({
        where: { id_usuario: idUsuario },
        include: { imagenes: true, etiquetas: { include: { etiqueta: true } } },
        orderBy: { fecha_publicacion: "desc" },
    });
}

export async function buscarPublicacionesPorTipo(tipoPerfil: number): Promise<Publicacion[]> {
    return prisma.publicacion.findMany({
        where: { tipo_publicacion: tipoPerfil },
        include: { imagenes: true, etiquetas: { include: { etiqueta: true } } },
        orderBy: { fecha_publicacion: "desc" },
    });
}

export async function guardarPublicacion(
    data: Prisma.PublicacionCreateInput
): Promise<Publicacion> {
    return prisma.publicacion.create({ data });
}

export async function actualizarPublicacion(
    id: number,
    data: Prisma.PublicacionUpdateInput
): Promise<Publicacion> {
    return prisma.publicacion.update({ where: { id_publicacion: id }, data });
}

export async function eliminarPublicacion(id: number): Promise<Publicacion> {
    return prisma.publicacion.delete({ where: { id_publicacion: id } });
}

// ─────────────────────────────────────────────
// Imagen de Publicacion
// ─────────────────────────────────────────────

export async function buscarImagenPorId(id: number): Promise<ImagenPublicacion | null> {
    return prisma.imagenPublicacion.findUnique({ where: { id_imagen: id } });
}

export async function buscarImagenesPorPublicacion(
    idPublicacion: number
): Promise<ImagenPublicacion[]> {
    return prisma.imagenPublicacion.findMany({ where: { id_publicacion: idPublicacion } });
}

export async function guardarImagen(
    data: Prisma.ImagenPublicacionCreateInput
): Promise<ImagenPublicacion> {
    return prisma.imagenPublicacion.create({ data });
}

export async function eliminarImagen(id: number): Promise<ImagenPublicacion> {
    return prisma.imagenPublicacion.delete({ where: { id_imagen: id } });
}

// ─────────────────────────────────────────────
// Etiqueta
// ─────────────────────────────────────────────

export async function buscarEtiquetaPorId(id: number): Promise<Etiqueta | null> {
    return prisma.etiqueta.findUnique({ where: { id_etiqueta: id } });
}

export async function buscarTodasLasEtiquetas(): Promise<Etiqueta[]> {
    return prisma.etiqueta.findMany({ include: { hijas: true } });
}

export async function guardarEtiqueta(data: Prisma.EtiquetaCreateInput): Promise<Etiqueta> {
    return prisma.etiqueta.create({ data });
}

export async function actualizarEtiqueta(
    id: number,
    data: Prisma.EtiquetaUpdateInput
): Promise<Etiqueta> {
    return prisma.etiqueta.update({ where: { id_etiqueta: id }, data });
}

export async function eliminarEtiqueta(id: number): Promise<Etiqueta> {
    return prisma.etiqueta.delete({ where: { id_etiqueta: id } });
}