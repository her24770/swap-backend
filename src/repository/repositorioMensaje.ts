import { Prisma, Conversacion, Mensaje } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

// ─────────────────────────────────────────────
// Conversacion
// ─────────────────────────────────────────────

export async function buscarConversacionPorId(id: number): Promise<(Conversacion & { mensajes: Mensaje[] }) | null> {
    return prisma.conversacion.findUnique({
        where: { id_conversacion: id },
        include: { mensajes: { orderBy: { fecha_enviado: "asc" } } },
    });
}

export async function buscarConversacionEntreDosUsuarios(
    idUsuario1: number,
    idUsuario2: number
): Promise<(Conversacion & { mensajes: Mensaje[] }) | null> {
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

const conversacionConUltimoMensaje = Prisma.validator<Prisma.ConversacionDefaultArgs>()({
    include: {
        usuario1: { select: { id_usuario: true, nombre: true, url_foto_perfil: true } },
        usuario2: { select: { id_usuario: true, nombre: true, url_foto_perfil: true } },
        mensajes: { orderBy: { fecha_enviado: "desc" }, take: 1 },
        contextos: {
            orderBy: { fecha_contexto: "desc" },
            include: {
                publicacion: {
                    select: {
                        id_publicacion: true,
                        titulo: true,
                        precio: true,
                        id_usuario: true,
                        imagenes: {
                            select: {
                                url_imagen: true,
                            },
                            take: 1,
                        },
                    },
                },
                usuario: {
                    select: {
                        id_usuario: true,
                        nombre: true,
                        },
                    },
                },
            },
    },
});

export type ConversacionConUltimoMensaje = Prisma.ConversacionGetPayload<typeof conversacionConUltimoMensaje>;

export async function buscarConversacionCompletaPorId(
    id: number
): Promise<ConversacionConUltimoMensaje | null> {
    return prisma.conversacion.findUnique({
        where: { id_conversacion: id },
        ...conversacionConUltimoMensaje,
    });
}

export async function buscarConversacionesPorUsuario(idUsuario: number): Promise<ConversacionConUltimoMensaje[]> {
    return prisma.conversacion.findMany({
        where: {
            OR: [{ id_usuario_1: idUsuario }, { id_usuario_2: idUsuario }],
        },
        ...conversacionConUltimoMensaje,
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

interface MensajeConNotificacionInput {
    idConversacion: number;
    idEmisor: number;
    idReceptor: number;
    texto: string;
    idEstadoEnviado: number;
    idPublicacion?: number;
}

export async function guardarMensajeConNotificacion(input: MensajeConNotificacionInput) {
    return prisma.$transaction(async (tx) => {
        if (input.idPublicacion !== undefined) {
            await tx.contextoConversacion.upsert({
                where: {
                    id_conversacion_id_publicacion: {
                        id_conversacion: input.idConversacion,
                        id_publicacion: input.idPublicacion,
                    },
                },
                update: {},
                create: {
                    id_conversacion: input.idConversacion,
                    id_publicacion: input.idPublicacion,
                    id_usuario: input.idEmisor,
                },
            });
        }

        const mensaje = await tx.mensaje.create({
            data: {
                id_conversacion: input.idConversacion,
                id_emisor: input.idEmisor,
                mensaje: input.texto,
                estado_mensaje: input.idEstadoEnviado,
            },
        });
        const notificacion = await tx.notificacion.create({
            data: {
                id_usuario: input.idReceptor,
                mensaje: "Tienes un nuevo mensaje",
                id_estado: input.idEstadoEnviado,
            },
            include: { estado: { select: { estado: true } } },
        });
        const conversacion = await tx.conversacion.findUnique({
            where: { id_conversacion: input.idConversacion },
            ...conversacionConUltimoMensaje,
        });

        return { mensaje, notificacion, conversacion };
    });
}

interface ConversacionInicialInput {
    idEmisor: number;
    idReceptor: number;
    texto: string;
    idEstadoPendiente: number;
    idEstadoEnviado: number;
    idPublicacion?: number;
}

export async function guardarConversacionConMensajeInicial(input: ConversacionInicialInput) {
    return prisma.$transaction(async (tx) => {
        const creada = await tx.conversacion.create({
            data: {
                id_usuario_1: input.idEmisor,
                id_usuario_2: input.idReceptor,
                estado_conversacion: input.idEstadoPendiente,
            },
        });

        if (input.idPublicacion !== undefined) {
            await tx.contextoConversacion.create({
                data: {
                    id_conversacion: creada.id_conversacion,
                    id_publicacion: input.idPublicacion,
                    id_usuario: input.idEmisor,
                },
            });
        }

        const mensaje = await tx.mensaje.create({
            data: {
                id_conversacion: creada.id_conversacion,
                id_emisor: input.idEmisor,
                mensaje: input.texto,
                estado_mensaje: input.idEstadoEnviado,
            },
        });
        const notificacion = await tx.notificacion.create({
            data: {
                id_usuario: input.idReceptor,
                mensaje: "Tienes un nuevo mensaje",
                id_estado: input.idEstadoEnviado,
            },
            include: { estado: { select: { estado: true } } },
        });
        const conversacion = await tx.conversacion.findUnique({
            where: { id_conversacion: creada.id_conversacion },
            ...conversacionConUltimoMensaje,
        });
        if (!conversacion) throw new Error("No se pudo recuperar la conversación creada");

        return { conversacion, mensaje, notificacion };
    });
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
