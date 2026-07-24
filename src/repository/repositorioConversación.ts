import{Prisma, Conversacion} from "@prisma/client";
import prisma from "../persistencia/prismaClient";
import { ObtenerConversacionInput } from "../modelo/schemaConversacion";

export async function obtenerConversacion(data: ObtenerConversacionInput): Promise<Conversacion | null> {
    return await prisma.conversacion.findFirst({
        where: {
            id_usuario_1: data.id_usuario_1,
            id_usuario_2: data.id_usuario_2,
            estado_conversacion: data.estado_conversacion
        }
    });

}