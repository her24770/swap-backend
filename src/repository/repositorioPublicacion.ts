import { Prisma, Publicacion, ImagenPublicacion, Etiqueta } from "@prisma/client";
import prisma from "../persistencia/prismaClient";
import { PaginationOption } from "./types";
// ─────────────────────────────────────────────
// Publicacion
// ─────────────────────────────────────────────

export async function buscarPublicacionPorId(id: number): Promise<Publicacion | null> {
    return prisma.publicacion.findUnique({
        where: { id_publicacion: id }
    });
}

export async function buscarPublicacionPorIdDetallado(id: number): Promise<any | null> {
    const publicacion = await prisma.publicacion.findUnique({
        where: { id_publicacion: id },
        include: {
            imagenes: {
                select: {
                    id_imagen: true,
                    url_imagen: true
                }
            },
            etiquetas: {
                include: {
                    etiqueta: {
                        select: {
                            id_etiqueta: true,
                            nombre: true,
                            descripcion: true,
                            id_etiqueta_padre: true
                        }
                    }
                }
            },
            estadoRel: {
                select: {
                    id_estado: true,
                    estado: true
                }
            },
            tipoPerfil: {
                select: {
                    id_tipo_perfil: true,
                    tipo_perfil: true
                }
            },
            usuario: {
                select: {
                    id_usuario: true,
                    nombre: true,
                    email_institucional: true,
                    url_foto_perfil: true,
                    calificacion: true
                }
            }
        },
    });

    if (!publicacion) return null;
    return publicacion;
}

export async function buscarTodasLasPublicaciones(): Promise<Publicacion[]> {
    return prisma.publicacion.findMany({
        include: { imagenes: true, etiquetas: { include: { etiqueta: true } } },
        orderBy: { fecha_publicacion: "desc" },
    });
}

export async function buscarPublicacionesPorUsuario(idUsuario: number): Promise<Publicacion[]> {
    return prisma.publicacion.findMany({
        where: { id_usuario: idUsuario },
        include: { imagenes: true, etiquetas: { include: { etiqueta: true } } },
        orderBy: { fecha_publicacion: "desc" },
    });
}

export async function buscarPublicacionesPaginadas(options: PaginationOption): Promise<Publicacion[]> {
    //Valores por defecto
    const { page = 1, limit = 10, sort = 'fecha', order = 'desc', tipo, estado } = options;

    //Cálculo de paginación
    const skip = (page - 1) * limit;

    const orderBy: any = {}
    switch (sort) {
        case 'fecha':
            orderBy.fecha_publicacion = order;
            break;
        case 'me_gusta':
            orderBy.me_gusta = order;
            break;
        case 'precio':
            orderBy.precio = order;
            break;
        default:
            orderBy.fecha_publicacion = order;
            break;
    }

    const where: any = {};
    if (tipo) {
        const tipoPerfil = await prisma.tipoPerfil.findUnique({
            where: { tipo_perfil: tipo }
        })
        if (tipoPerfil) {
            where.tipo_publicacion = tipoPerfil.id_tipo_perfil;
        }
    }
    if (estado) {
        const estadoObtenido = await prisma.estado.findUnique({
            where: { estado: estado }
        })
        if (estadoObtenido) {
            where.estado = estadoObtenido.id_estado;
        }
    }

    return await prisma.publicacion.findMany({
        where,
        include: { imagenes: true, etiquetas: { include: { etiqueta: true } } },
        orderBy,
        skip,
        take: limit
    });
}

export async function guardarPublicacion(
    data: Prisma.PublicacionCreateInput
): Promise<Publicacion> {
    return prisma.publicacion.create({ data });
}

export async function actualizarPublicacion(
    id: number,
    data: Prisma.PublicacionUpdateInput
): Promise<Publicacion> {
    return prisma.publicacion.update({ where: { id_publicacion: id }, data });
}

export async function actualizarEstadoPublicacion(id: number, id_estado: number): Promise<Publicacion> {
    return prisma.publicacion.update({ where: { id_publicacion: id }, data: { estado: id_estado } });
}

export async function eliminarPublicacion(id: number): Promise<Publicacion> {
    return prisma.publicacion.delete({ where: { id_publicacion: id } });
}

export async function buscarPublicacionesPorTipoYUsuario(tipoPerfil: string, idUsuario: number, estado?: string): Promise<any[]> {
    const where: any = {
        id_usuario: idUsuario,
        tipoPerfil: {
            tipo_perfil: tipoPerfil
        }
    }
    if (estado) {
        const estadoObtenido = await prisma.estado.findUnique({
            where: { estado: estado }
        })
        if (estadoObtenido) {
            where.estado = estadoObtenido.id_estado;
        }
    }

    return prisma.publicacion.findMany({
        where,
        include: {
            imagenes: true,
            etiquetas: { include: { etiqueta: true } },
            estadoRel: { select: { id_estado: true, estado: true } },
        },
        orderBy: { fecha_publicacion: "desc" },
    });
}

// ─────────────────────────────────────────────
// Imagen de Publicacion
// ─────────────────────────────────────────────

export async function buscarImagenPorId(id: number): Promise<ImagenPublicacion | null> {
    return prisma.imagenPublicacion.findUnique({ where: { id_imagen: id } });
}

export async function buscarImagenesPorPublicacion(
    idPublicacion: number
): Promise<ImagenPublicacion[]> {
    return prisma.imagenPublicacion.findMany({ where: { id_publicacion: idPublicacion } });
}

export async function guardarImagen(
    data: Prisma.ImagenPublicacionCreateInput
): Promise<ImagenPublicacion> {
    return prisma.imagenPublicacion.create({ data });
}

export async function eliminarImagen(id: number): Promise<ImagenPublicacion> {
    return prisma.imagenPublicacion.delete({ where: { id_imagen: id } });
}

// ─────────────────────────────────────────────
// Etiqueta
// ─────────────────────────────────────────────

export async function buscarEtiquetaPorId(id: number): Promise<Etiqueta | null> {
    return prisma.etiqueta.findUnique({ where: { id_etiqueta: id } });
}

export async function buscarTodasLasEtiquetas(): Promise<Etiqueta[]> {
    return prisma.etiqueta.findMany({ include: { hijas: true } });
}

export async function guardarEtiqueta(data: Prisma.EtiquetaCreateInput): Promise<Etiqueta> {
    return prisma.etiqueta.create({ data });
}

export async function actualizarEtiqueta(
    id: number,
    data: Prisma.EtiquetaUpdateInput
): Promise<Etiqueta> {
    return prisma.etiqueta.update({ where: { id_etiqueta: id }, data });
}

export async function eliminarEtiqueta(id: number): Promise<Etiqueta> {
    return prisma.etiqueta.delete({ where: { id_etiqueta: id } });
}


// Obtener los datos de varias publicaciones a la vez (Uso inicial: Publicaciones recomendadas)
export async function buscarPublicacionesPorIdsDetallado(
    ids: number[]
): Promise<any[]> {

    const publicaciones = await prisma.publicacion.findMany({

        where: {
            id_publicacion: {
                in: ids
            }
        },

        include: {

            imagenes: {
                select: {
                    id_imagen: true,
                    url_imagen: true
                }
            },

            etiquetas: {
                include: {
                    etiqueta: {
                        select: {
                            id_etiqueta: true,
                            nombre: true,
                            descripcion: true,
                            id_etiqueta_padre: true
                        }
                    }
                }
            },

            estadoRel: {
                select: {
                    id_estado: true,
                    estado: true
                }
            },

            tipoPerfil: {
                select: {
                    id_tipo_perfil: true,
                    tipo_perfil: true
                }
            },

            usuario: {
                select: {
                    id_usuario: true,
                    nombre: true,
                    email_institucional: true,
                    url_foto_perfil: true,
                    calificacion: true
                }
            }
        }
    });

    // Mantener orden original del ranking
    const orden = new Map<number, number>();

    ids.forEach((id, index) => {
        orden.set(id, index);
    });

    publicaciones.sort((a, b) => {
        return (
            (orden.get(a.id_publicacion) ?? 0) -
            (orden.get(b.id_publicacion) ?? 0)
        );
    });

    return publicaciones;
}