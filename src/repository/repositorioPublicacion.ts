import { Prisma, Publicacion, ImagenPublicacion, Etiqueta } from "@prisma/client";
import prisma from "../persistencia/prismaClient";
import { FiltrosPublicacionInput, PaginationOptionInput } from "../modelo/schemaPublicacion";
import { ResultadoBusquedaPublicacion } from "./types";

// ─────────────────────────────────────────────
// Publicacion
// ─────────────────────────────────────────────

export async function buscarPublicacionPorId(id: number): Promise<Publicacion | null> {
    return prisma.publicacion.findUnique({
        where: { id_publicacion: id }
    });
}

export async function buscarPublicacionPorIdDetallado(id: number, idUsuario?: number): Promise<any | null> {
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
            },
            usuarioPublicacions: idUsuario
                ? { where: { id_usuario: idUsuario }, select: { is_save: true, is_like: true } }
                : false
        },
    });

    if (!publicacion) return null;

    const relacion = idUsuario ? (publicacion.usuarioPublicacions?.[0] ?? null) : null;
    const { usuarioPublicacions, ...resto } = publicacion;

    return {
        ...resto,
        guardado: relacion?.is_save ?? false,
        likeado: relacion?.is_like ?? false
    };
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

export async function buscarPublicacionesPaginadas(options: PaginationOptionInput, idUsuario?: number): Promise<ResultadoBusquedaPublicacion> {
    //Valores por defecto
    const { page = 1, limit = 10, sort = 'fecha', order = 'desc', tipo, estado } = options;

    //Cálculo de paginación
    const skip = (page - 1) * limit;

    const orderBy: any[] = [];

    // Destacadas primero siempre
    orderBy.push({ is_pinned: 'desc' });

    switch (sort) {
        case 'fecha':
            orderBy.push({ fecha_publicacion: order });
            break;
        case 'me_gusta':
            orderBy.push({ me_gusta: order });
            break;
        case 'precio':
            orderBy.push({ precio: order });
            break;
        default:
            orderBy.push({ fecha_publicacion: order });
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

    const [publicaciones, total] = await prisma.$transaction([

        prisma.publicacion.findMany({
            where,
            include: {
                imagenes: true,
                etiquetas: { include: { etiqueta: true } },
                estadoRel: { select: { id_estado: true, estado: true } },

                // Solo traer la relación del usuario autenticado
                usuarioPublicacions: idUsuario
                    ? {
                        where: { id_usuario: idUsuario },
                        select: {
                            is_save: true,
                            is_like: true
                        }
                    }
                    : false
            },
            orderBy,
            skip,
            take: limit
        }),

        prisma.publicacion.count({
            where
        })

    ]);

    // Mapear para aplanar guardado y likeado
    const publicacionesMapeadas = publicaciones.map((pub) => {

        const relacion = idUsuario
            ? (pub.usuarioPublicacions?.[0] ?? null)
            : null;

        const { usuarioPublicacions, ...resto } = pub;

        return {
            ...resto,
            guardado: relacion?.is_save ?? false,
            likeado: relacion?.is_like ?? false
        };
    });

    return {
        publicaciones: publicacionesMapeadas,
        total
    };
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

export async function buscarPublicacionesDestacadasUsuario(idUsuario: number): Promise<any[]> {
    return prisma.publicacion.findMany({
        where: {
            id_usuario: idUsuario,
            is_pinned: true
        },
        include: {
            imagenes: true,
            etiquetas: { include: { etiqueta: true } },
            estadoRel: { select: { id_estado: true, estado: true } },
            tipoPerfil: { select: { id_tipo_perfil: true, tipo_perfil: true } }
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

// ─────────────────────────────────────────────
// Destacados
// ─────────────────────────────────────────────

export async function contarPublicacionesDestacadasPorTipoYUsuario(
    idUsuario: number,
    idTipoPerfil: number
): Promise<number> {
    return prisma.publicacion.count({
        where: {
            id_usuario: idUsuario,
            tipo_publicacion: idTipoPerfil,
            is_pinned: true
        }
    });
}

export async function actualizarDestacado(
    idPublicacion: number,
    isPinned: boolean
): Promise<Publicacion> {
    return prisma.publicacion.update({
        where: { id_publicacion: idPublicacion },
        data: { is_pinned: isPinned }
    });
}
  
// -------------------------

export async function buscarPorSimilitudVectorial(
    vector: number[],
    limite: number = 20,
    umbral: number = 0.35,
    tipo?: string
): Promise<number[]> {
    const vectorStr = `[${vector.join(',')}]`;

    const resultados = tipo
        ? await prisma.$queryRaw<{ id_publicacion: number }[]>`
            SELECT p.id_publicacion
            FROM "Publicacion" p
            INNER JOIN "Estado" e ON e.id_estado = p.estado
            INNER JOIN "Tipo_Perfil" tp ON tp.id_tipo_perfil = p.tipo_publicacion
            WHERE p.embedding IS NOT NULL
            AND e.estado = 'activo'
            AND tp.tipo_perfil = ${tipo}
            AND 1 - (p.embedding <=> ${vectorStr}::vector) >= ${umbral}
            ORDER BY p.embedding <=> ${vectorStr}::vector
            LIMIT ${limite}
        `
        : await prisma.$queryRaw<{ id_publicacion: number }[]>`
            SELECT p.id_publicacion
            FROM "Publicacion" p
            INNER JOIN "Estado" e ON e.id_estado = p.estado
            WHERE p.embedding IS NOT NULL
            AND e.estado = 'activo'
            AND 1 - (p.embedding <=> ${vectorStr}::vector) >= ${umbral}
            ORDER BY p.embedding <=> ${vectorStr}::vector
            LIMIT ${limite}
        `;

    return resultados.map(r => r.id_publicacion);
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

// ─────────────────────────────────────────────
// Filtros de Publicaciones
// ─────────────────────────────────────────────


export async function buscarPublicacionesPorFiltros(
    options: FiltrosPublicacionInput
): Promise<Publicacion[]> {
        const where: any = {}; 
    // 1. Filtro por precio
    if (options.precio_min !== undefined || options.precio_max !== undefined) {
        where.precio = {};
        if (options.precio_min !== undefined) where.precio.gte = options.precio_min;
        if (options.precio_max !== undefined) where.precio.lte = options.precio_max;
    }
    // 2. Filtro por calificación del usuario (vendedor)
    if (options.calificacion_min !== undefined || options.calificacion_max !== undefined) {
        where.usuario = {};
        if (options.calificacion_min !== undefined) where.usuario.calificacion = { gte: options.calificacion_min };
        if (options.calificacion_max !== undefined) {
            where.usuario.calificacion = { 
                ...where.usuario.calificacion, 
                lte: options.calificacion_max 
            };
        }
    }
    // 3. Filtro por etiquetas

    if (options.etiquetas && options.etiquetas.length > 0) {

        // Buscar etiquetas especiales por nombre
        const etiquetasEspeciales = await prisma.etiqueta.findMany({
            where: {
                nombre: {
                    in: ["Compra", "Alquiler"]
                }
            },
            select: {
                id_etiqueta: true,
                nombre: true
            }
        });

        const compra = etiquetasEspeciales.find(
            (e) => e.nombre === "Compra"
        );

        const alquiler = etiquetasEspeciales.find(
            (e) => e.nombre === "Alquiler"
        );

        const etiquetas = options.etiquetas;

        const tieneCompra =
            compra &&
            etiquetas.includes(compra.id_etiqueta);

        const tieneAlquiler =
            alquiler &&
            etiquetas.includes(alquiler.id_etiqueta);

        // Etiquetas normales
        const etiquetasNormales = etiquetas.filter(
            (id) =>
                id !== compra?.id_etiqueta &&
                id !== alquiler?.id_etiqueta
        );

        const condicionesEtiquetas: any[] = [];

        // Etiquetas normales → OR
        if (etiquetasNormales.length > 0) {
            condicionesEtiquetas.push({
                etiquetas: {
                    some: {
                        id_etiqueta: {
                            in: etiquetasNormales
                        }
                    }
                }
            });
        }

        // SOLO compra
        if (tieneCompra && !tieneAlquiler) {
            condicionesEtiquetas.push({
                etiquetas: {
                    some: {
                        id_etiqueta: compra.id_etiqueta
                    }
                }
            });
        }

        // SOLO alquiler
        if (tieneAlquiler && !tieneCompra) {
            condicionesEtiquetas.push({
                etiquetas: {
                    some: {
                        id_etiqueta: alquiler.id_etiqueta
                    }
                }
            });
        }

        if (condicionesEtiquetas.length > 0) {
            where.AND = condicionesEtiquetas;
        }
    }
    // 4. Filtro por tipo de publicación
    if (options.tipo) {
        const tipoPerfil = await prisma.tipoPerfil.findUnique({
            where: { tipo_perfil: options.tipo }
        });
        if (tipoPerfil) {
            where.tipo_publicacion = tipoPerfil.id_tipo_perfil;
        } else {
            return []; // Tipo no existe, devolver vacío
        }
    }
    // 5. Filtro por estado
    if (options.estado) {
        const estadoObtenido = await prisma.estado.findUnique({
            where: { estado: options.estado }
        });
        if (estadoObtenido) {
            where.estado = estadoObtenido.id_estado;
        }
    }
    // 6. Ordenamiento
    const orderBy: any = {};
    switch (options.sort) {
        case 'fecha':
            orderBy.fecha_publicacion = options.order;
            break;
        case 'me_gusta':
            orderBy.me_gusta = options.order;
            break;
        case 'precio':
            orderBy.precio = options.order;
            break;
        case 'calificacion':
            orderBy.usuario = {
                calificacion: options.order
            }
            break;
        default:
            orderBy.fecha_publicacion = 'desc';
    }
    
    // 7. Paginación
    const skip = ((options.page || 1) - 1) * (options.limit || 10);
    const take = options.limit || 10;
    
    return prisma.publicacion.findMany({
        where,
        include: {
            imagenes: true,
            etiquetas: {
                include: { etiqueta: true }
            },
            usuario: {
                select : { calificacion : true }
            }
        },
        orderBy,
        skip,
        take
    });
}