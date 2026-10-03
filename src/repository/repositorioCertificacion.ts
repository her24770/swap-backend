import { Certificacion } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

export async function crearCertificacion(data: {
    id_usuario: number;
    nombre: string;
    ruta_pdf: string;
    lugar_emision: string;
    id_etiqueta: number;
}): Promise<Certificacion> {
    return prisma.certificacion.create({ data });
}

export async function eliminarCertificacion(id_certificacion: number): Promise<Certificacion> {
    return prisma.certificacion.delete({ where: { id_certificacion } });
}

export async function buscarCertificacionesPorUsuario(id_usuario: number) {
    return prisma.certificacion.findMany({
        where: { id_usuario },
        include: { etiqueta: true },
        orderBy: { id_certificacion: "desc" },
    });
}

export async function buscarCertificacionPorId(id_certificacion: number) {
    return prisma.certificacion.findUnique({
        where: { id_certificacion },
        include: { etiqueta: true, usuario: { select: { id_usuario: true, nombre: true, url_foto_perfil: true } } },
    });
}

export async function contarCertificacionesPorUsuario(id_usuario: number): Promise<number> {
    return prisma.certificacion.count({ where: { id_usuario } });
}

/**
 * Busca si ya existe una certificacion para el usuario con exactamente
 * el mismo nombre, lugar de emision e id_etiqueta.
 */
export async function buscarCertificacionDuplicada(
    id_usuario: number,
    nombre: string,
    lugar_emision: string,
    id_etiqueta: number
): Promise<Certificacion | null> {
    return prisma.certificacion.findFirst({
        where: {
            id_usuario,
            nombre,
            lugar_emision,
            id_etiqueta,
        },
    });
}
