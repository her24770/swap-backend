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
    q?: string;
    estado?: string;
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
    const { tipo, page, limit, q, estado } = opciones;

    const tiposPublicacion = obtenerTiposPublicacionHistorial(tipo);
    const search = q?.trim();

    const where: Prisma.AcuerdoWhereInput = {
        id_usuario: idUsuario
    };

    if (estado) {
        where.estadoRel = {
            estado: estado.toLowerCase()
        };
    }

    if (tiposPublicacion) {
        where.publicacion = {
            tipoPerfil: {
                tipo_perfil: {
                    in: tiposPublicacion
                }
            }
        };
    }

    if (search) {
        where.OR = [
            { lugar_entrega: { contains: search, mode: "insensitive" } },
            { publicacion: { titulo: { contains: search, mode: "insensitive" } } },
            { publicacion: { descripcion: { contains: search, mode: "insensitive" } } },
            { publicacion: { usuario: { nombre: { contains: search, mode: "insensitive" } } } }
        ];
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
        orderBy: {
            fecha_entrega: "desc"
        }
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

/*
    Obtener acuerdos asociados a una conversacion
*/
export async function obtenerAcuerdosPorConversacion(idConversacion: number): Promise<Acuerdo[] | []> {
    return await prisma.acuerdo.findMany({
        where: { id_conversacion: idConversacion },
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

// Funcion de verificación de existencia de una solicitud con los mismo datos que recibe
export async function existeSolicitudDuplicada(
    idUsuario: number,
    idPublicacion: number,
    idConversacion: number,
    fechaEntrega: Date,
    lugarEntrega: string,
    observaciones: string
): Promise<boolean> {
    const acuerdo = await prisma.acuerdo.findFirst({
        where: {
            id_usuario: idUsuario,
            id_publicacion: idPublicacion,
            id_conversacion: idConversacion,
            fecha_entrega: fechaEntrega,
            lugar_entrega: lugarEntrega,
            observaciones
        }
    });

    return acuerdo !== null;
}

// Contar acuerdos activos de una conversacion
export async function contarAcuerdosActivosConversacion(
    idConversacion: number
): Promise<number> {
    return prisma.acuerdo.count({
        where: {
            id_conversacion: idConversacion,
            estadoRel: {
                estado: {
                    in: ["activo", "pendiente"]
                }
            }
        }
    });
}

export async function crearAcuerdo(data: Prisma.AcuerdoCreateInput): Promise<Acuerdo> {
    return await prisma.acuerdo.create({ data });
}
