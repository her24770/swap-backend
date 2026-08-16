import { ContextoConversacion } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

export async function registrarContextoConversacion(
    idConversacion: number,
    idPublicacion: number,
    idUsuario: number
): Promise<ContextoConversacion> {
    return prisma.contextoConversacion.upsert({
        where: {
            id_conversacion_id_publicacion: {
                id_conversacion: idConversacion,
                id_publicacion: idPublicacion,
            },
        },
        update: {},
        create: {
            conversacion: {
                connect: { id_conversacion: idConversacion },
            },
            publicacion: {
                connect: { id_publicacion: idPublicacion },
            },
            usuario: {
                connect: { id_usuario: idUsuario },
            },
        },
    });
}