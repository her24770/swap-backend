import { Acuerdo } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

/*
    Obtener acuerdos de un usuario que recibe algún material/servicio/tutoria
*/
export async function obtenerAcuerdosPorUsuario(idUsuario: number): Promise<Acuerdo[] | []> {
    return await prisma.acuerdo.findMany({
        where: { id_usuario: idUsuario },
        include: {
            publicacion: {
                include: {
                    imagenes: true,
                    usuario: {
                        select: {
                            id_usuario: true,
                            nombre: true,
                            url_foto_perfil: true
                        }
                    }
                }
            },
            estadoRel: true
        },
        orderBy: { fecha_entrega: "desc" }
    });
}

/*
    Obtener acuerdos de una publicacion
*/
export async function obtenerAcuerdosPorPublicacion(idPublicacion: number): Promise<Acuerdo[] | []> {
    return await prisma.acuerdo.findMany({ where: { id_publicacion: idPublicacion } });
}
