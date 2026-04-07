import { Prisma, Conversacion, Mensaje } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

// ─────────────────────────────────────────────
// Conversacion
// ─────────────────────────────────────────────

export async function buscarConversacionPorId(id: number): Promise<Conversacion | null> {
    return prisma.conversacion.findUnique({
        where: { id_conversacion: id },
        include: { mensajes: { orderBy: { fecha_enviado: "asc" } } },
    });
}

export async function buscarConversacionEntreDosUsuarios(
    idUsuario1: number,
    idUsuario2: number
): Promise<Conversacion | null> {
    return prisma.conversacion.findFirst({
        where: {
            OR: [
                { id_usuario_1: idUsuario1, id_usuario_2: idUsuario2 },
                { id_usuario_1: idUsuario2, id_usuario_2: idUsuario1 },
            ],
        },
        include: { mensajes: { orderBy: { fecha_enviado: "asc" } } },
    });
}

export async function buscarConversacionesPorUsuario(idUsuario: number): Promise<Conversacion[]> {
    return prisma.conversacion.findMany({
        where: {
            OR: [{ id_usuario_1: idUsuario }, { id_usuario_2: idUsuario }],
        },
        include: {
            usuario1: { select: { id_usuario: true, nombre: true, url_foto_perfil: true } },
            usuario2: { select: { id_usuario: true, nombre: true, url_foto_perfil: true } },
            mensajes: { orderBy: { fecha_enviado: "desc" }, take: 1 },
        },
        orderBy: { id_conversacion: "desc" },
    });
}

export async function guardarConversacion(
    data: Prisma.ConversacionCreateInput
): Promise<Conversacion> {
    return prisma.conversacion.create({ data });
}

export async function actualizarConversacion(
    id: number,
    data: Prisma.ConversacionUpdateInput
): Promise<Conversacion> {
    return prisma.conversacion.update({ where: { id_conversacion: id }, data });
}

export async function eliminarConversacion(id: number): Promise<Conversacion> {
    return prisma.conversacion.delete({ where: { id_conversacion: id } });
}

// ─────────────────────────────────────────────
// Mensaje
// ─────────────────────────────────────────────

export async function buscarMensajePorId(id: number): Promise<Mensaje | null> {
    return prisma.mensaje.findUnique({ where: { id_mensaje: id } });
}

export async function buscarMensajesPorConversacion(idConversacion: number): Promise<Mensaje[]> {
    return prisma.mensaje.findMany({
        where: { id_conversacion: idConversacion },
        orderBy: { fecha_enviado: "asc" },
    });
}

export async function guardarMensaje(data: Prisma.MensajeCreateInput): Promise<Mensaje> {
    return prisma.mensaje.create({ data });
}

export async function actualizarMensaje(
    id: number,
    data: Prisma.MensajeUpdateInput
): Promise<Mensaje> {
    return prisma.mensaje.update({ where: { id_mensaje: id }, data });
}

export async function eliminarMensaje(id: number): Promise<Mensaje> {
    return prisma.mensaje.delete({ where: { id_mensaje: id } });
}