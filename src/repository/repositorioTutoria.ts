import { Prisma, TiempoDisponible, Acuerdo } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

// ─────────────────────────────────────────────
// TiempoDisponible
// ─────────────────────────────────────────────

export async function buscarTiempoPorId(id: number): Promise<TiempoDisponible | null> {
    return prisma.tiempoDisponible.findUnique({ where: { id_tiempo: id } });
}

export async function buscarTiemposPorUsuario(idUsuario: number): Promise<TiempoDisponible[]> {
    return prisma.tiempoDisponible.findMany({
        where: { id_usuario: idUsuario },
        orderBy: { hora_inicio: "asc" } as any,
    });
}

export async function buscarTodosLosTiempos(): Promise<TiempoDisponible[]> {
    return prisma.tiempoDisponible.findMany({ orderBy: { hora_inicio: "asc" } as any });
}

export async function guardarTiempo(
    data: Prisma.TiempoDisponibleCreateInput
): Promise<TiempoDisponible> {
    return prisma.tiempoDisponible.create({ data });
}

export async function actualizarTiempo(
    id: number,
    data: Prisma.TiempoDisponibleUpdateInput
): Promise<TiempoDisponible> {
    return prisma.tiempoDisponible.update({ where: { id_tiempo: id }, data });
}

export async function eliminarTiempo(id: number): Promise<TiempoDisponible> {
    return prisma.tiempoDisponible.delete({ where: { id_tiempo: id } });
}

// ─────────────────────────────────────────────
// Acuerdo
// ─────────────────────────────────────────────

export async function buscarAcuerdoPorId(id: number): Promise<Acuerdo | null> {
    return prisma.acuerdo.findUnique({
        where: { id_acuerdo: id }
    });
}

export async function buscarAcuerdosPorUsuario(idUsuario: number): Promise<Acuerdo[]> {
    return prisma.acuerdo.findMany({
        where: { id_usuario: idUsuario },
        orderBy: { fecha_entrega: "asc" },
    });
}

export async function buscarTodosLosAcuerdos(): Promise<Acuerdo[]> {
    return prisma.acuerdo.findMany({
        orderBy: { fecha_entrega: "asc" },
    });
}

export async function guardarAcuerdo(data: Prisma.AcuerdoCreateInput): Promise<Acuerdo> {
    return prisma.acuerdo.create({ data });
}

export async function actualizarAcuerdo(
    id: number,
    data: Prisma.AcuerdoUpdateInput
): Promise<Acuerdo> {
    return prisma.acuerdo.update({ where: { id_acuerdo: id }, data });
}

export async function eliminarAcuerdo(id: number): Promise<Acuerdo> {
    return prisma.acuerdo.delete({ where: { id_acuerdo: id } });
}
