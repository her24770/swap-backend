import { Prisma, Reporte, PalabraRestringida } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

// ─────────────────────────────────────────────
// Reporte
// ─────────────────────────────────────────────

export async function buscarReportePorId(id: number): Promise<Reporte | null> {
    return prisma.reporte.findUnique({
        where: { id_reporte: id },
        include: {
            emisor: { select: { id_usuario: true, nombre: true, email_institucional: true } },
            receptor: { select: { id_usuario: true, nombre: true, email_institucional: true } },
            motivoRel: true,
            estadoRel: true,
        },
    });
}

export async function buscarTodosLosReportes(): Promise<Reporte[]> {
    return prisma.reporte.findMany({
        include: {
            emisor: { select: { id_usuario: true, nombre: true } },
            receptor: { select: { id_usuario: true, nombre: true } },
            motivoRel: true,
            estadoRel: true,
        },
        orderBy: { fecha: "desc" },
    });
}

export async function buscarReportesPorReceptor(idReceptor: number): Promise<Reporte[]> {
    return prisma.reporte.findMany({
        where: { id_receptor: idReceptor },
        include: { motivoRel: true, estadoRel: true },
        orderBy: { fecha: "desc" },
    });
}

export async function buscarReportesPorEmisor(idEmisor: number): Promise<Reporte[]> {
    return prisma.reporte.findMany({
        where: { id_emisor: idEmisor },
        include: { motivoRel: true, estadoRel: true },
        orderBy: { fecha: "desc" },
    });
}

export async function guardarReporte(data: Prisma.ReporteCreateInput): Promise<Reporte> {
    return prisma.reporte.create({ data });
}

export async function actualizarReporte(
    id: number,
    data: Prisma.ReporteUpdateInput
): Promise<Reporte> {
    return prisma.reporte.update({ where: { id_reporte: id }, data });
}

export async function eliminarReporte(id: number): Promise<Reporte> {
    return prisma.reporte.delete({ where: { id_reporte: id } });
}

// ─────────────────────────────────────────────
// PalabraRestringida
// ─────────────────────────────────────────────

export async function buscarPalabraRestringidaPorId(
    id: number
): Promise<PalabraRestringida | null> {
    return prisma.palabraRestringida.findUnique({ where: { id_palabra: id } });
}

export async function buscarTodasLasPalabrasRestringidas(): Promise<PalabraRestringida[]> {
    return prisma.palabraRestringida.findMany({ orderBy: { palabra: "asc" } });
}

export async function palabraEstaRestringida(palabra: string): Promise<boolean> {
    const resultado = await prisma.palabraRestringida.findUnique({
        where: { palabra: palabra.toLowerCase() },
    });
    return resultado !== null;
}

export async function guardarPalabraRestringida(
    data: Prisma.PalabraRestringidaCreateInput
): Promise<PalabraRestringida> {
    return prisma.palabraRestringida.create({ data });
}

export async function actualizarPalabraRestringida(
    id: number,
    data: Prisma.PalabraRestringidaUpdateInput
): Promise<PalabraRestringida> {
    return prisma.palabraRestringida.update({ where: { id_palabra: id }, data });
}

export async function eliminarPalabraRestringida(id: number): Promise<PalabraRestringida> {
    return prisma.palabraRestringida.delete({ where: { id_palabra: id } });
}