import { Acuerdo, Prisma } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

function obtenerTiposPublicacionHistorial(tipo?: string): string[] | undefined {
    if (!tipo) return undefined;

    const tipoNormalizado = tipo.toLowerCase();
    if (tipoNormalizado === "producto") return ["material", "negocio"];

    return [tipoNormalizado];
}

interface OpcionesAcuerdosUsuario {
    tipo?: string;
    page?: number;
    limit?: number;
}

export interface ResultadoAcuerdosUsuario {
    acuerdos: Acuerdo[];
    total: number;
}

/*
    Obtener acuerdos de un usuario que recibe algún material/servicio/tutoria
*/
export async function obtenerAcuerdosPorUsuario(
    idUsuario: number,
    opciones: OpcionesAcuerdosUsuario = {}
): Promise<ResultadoAcuerdosUsuario> {
    const { tipo, page, limit } = opciones;
    const tiposPublicacion = obtenerTiposPublicacionHistorial(tipo);
    const where: Prisma.AcuerdoWhereInput = {
        id_usuario: idUsuario,
        estadoRel: {
            estado: "completado"
        }
    };

    if (tiposPublicacion) {
        where.publicacion = {
            tipoPerfil: {
                tipo_perfil: {
                    in: tiposPublicacion
                }
            }
        };
    }

    const findManyArgs: Prisma.AcuerdoFindManyArgs = {
        where,
        include: {
            publicacion: {
                include: {
                    imagenes: true,
                    tipoPerfil: true,
                    usuario: {
                        select: {
                            id_usuario: true,
                            nombre: true,
                            url_foto_perfil: true,
                            calificacion: true
                        }
                    }
                }
            },
            estadoRel: true
        },
        orderBy: { fecha_entrega: "desc" }
    };

    if (page !== undefined && limit !== undefined) {
        findManyArgs.skip = (page - 1) * limit;
        findManyArgs.take = limit;
    }

    const [acuerdos, total] = await prisma.$transaction([
        prisma.acuerdo.findMany(findManyArgs),
        prisma.acuerdo.count({ where })
    ]);

    return { acuerdos, total };
}

/*
    Obtener acuerdos de una publicacion
*/
export async function obtenerAcuerdosPorPublicacion(idPublicacion: number): Promise<Acuerdo[] | []> {
    return await prisma.acuerdo.findMany({ where: { id_publicacion: idPublicacion } });
}
