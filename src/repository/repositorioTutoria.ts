import { Prisma, TiempoDisponible, Tutoria, Acuerdo } from "@prisma/client";
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
        orderBy: { inicio_intervalo: "asc" },
    });
}

export async function buscarTodosLosTiempos(): Promise<TiempoDisponible[]> {
    return prisma.tiempoDisponible.findMany({ orderBy: { inicio_intervalo: "asc" } });
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
        where: { id_acuerdo: id },
        include: { tutorias: true },
    });
}

export async function buscarAcuerdosPorUsuario(idUsuario: number): Promise<Acuerdo[]> {
    return prisma.acuerdo.findMany({
        where: { id_usuario: idUsuario },
        include: { tutorias: true },
        orderBy: { fecha_entrega: "asc" },
    });
}

export async function buscarTodosLosAcuerdos(): Promise<Acuerdo[]> {
    return prisma.acuerdo.findMany({
        include: { tutorias: true },
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

// ─────────────────────────────────────────────
// Tutoria (tabla intermedia Acuerdo ↔ TiempoDisponible)
// ─────────────────────────────────────────────

export async function buscarTutoriaPorId(
    idAcuerdo: number,
    idTiempo: number
): Promise<Tutoria | null> {
    return prisma.tutoria.findUnique({
        where: { id_acuerdo_id_tiempo: { id_acuerdo: idAcuerdo, id_tiempo: idTiempo } },
    });
}

export async function buscarTutoriasPorAcuerdo(idAcuerdo: number): Promise<Tutoria[]> {
    return prisma.tutoria.findMany({ where: { id_acuerdo: idAcuerdo } });
}

export async function guardarTutoria(data: Prisma.TutoriaCreateInput): Promise<Tutoria> {
    return prisma.tutoria.create({ data });
}

export async function eliminarTutoria(idAcuerdo: number, idTiempo: number): Promise<Tutoria> {
    return prisma.tutoria.delete({
        where: { id_acuerdo_id_tiempo: { id_acuerdo: idAcuerdo, id_tiempo: idTiempo } },
    });
}