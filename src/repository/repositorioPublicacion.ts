import { Prisma, Publicacion, ImagenPublicacion, Etiqueta } from "@prisma/client";
import prisma from "../persistencia/prismaClient";
import { FiltrosPublicacionInput, PaginationOptionInput } from "../modelo/schemaPublicacion";


// Interfaz para la búsqueda de publicaciones
export interface ResultadoBusquedaPublicacion {
    publicaciones: Publicacion[];
    total: number;
}

export interface FiltrosModeracionPublicaciones {
    page?: number;
    limit?: number;
    sort?: "fecha" | "me_gusta" | "precio";
    order?: "asc" | "desc";
    tipo?: string;
    estado?: string;
    q?: string;
}

// ─────────────────────────────────────────────
// Proyecciones/selectores reutilizables — evita repetir el mismo `select`
// en cada consulta que necesita el mismo resumen de una relación.
// ─────────────────────────────────────────────

const SELECT_ESTADO_RESUMEN = {
    select: { id_estado: true, estado: true },
} as const;

const SELECT_TIPO_PERFIL_RESUMEN = {
    select: { id_tipo_perfil: true, tipo_perfil: true },
} as const;

const SELECT_USUARIO_RESUMEN = {
    select: {
        id_usuario: true,
        nombre: true,
        email_institucional: true,
        url_foto_perfil: true,
        calificacion: true,
    },
} as const;

const SELECT_IMAGENES_RESUMEN = {
    select: { id_imagen: true, url_imagen: true },
} as const;

const INCLUDE_ETIQUETAS_DETALLADAS = {
    include: {
        etiqueta: {
            select: {
                id_etiqueta: true,
                nombre: true,
                descripcion: true,
                id_etiqueta_padre: true,
            },
        },
    },
} as const;

// Mapa de campo de ordenamiento — evita repetir el mismo switch en cada consulta.
const CAMPO_ORDEN: Record<"fecha" | "me_gusta" | "precio", "fecha_publicacion" | "me_gusta" | "precio"> = {
    fecha: "fecha_publicacion",
    me_gusta: "me_gusta",
    precio: "precio",
};

// Resuelve el nombre de un tipo de perfil a su ID. Cada llamador decide qué
// hacer si no existe (algunos ignoran el filtro, otros devuelven vacío).
async function resolverIdTipoPerfilPorNombre(tipo?: string): Promise<number | undefined> {
    if (!tipo) return undefined;
    const tipoPerfil = await prisma.tipoPerfil.findUnique({ where: { tipo_perfil: tipo } });
    return tipoPerfil?.id_tipo_perfil;
}

// Resuelve el nombre de un estado a su ID. Mismo criterio que arriba.
async function resolverIdEstadoPorNombre(estado?: string): Promise<number | undefined> {
    if (!estado) return undefined;
    const estadoObtenido = await prisma.estado.findUnique({ where: { estado } });
    return estadoObtenido?.id_estado;
}

// ─────────────────────────────────────────────
// Publicacion
// ─────────────────────────────────────────────

export async function buscarPublicacionPorId(id: number) {
    return prisma.publicacion.findUnique({
        where: { id_publicacion: id },
        include: {
            estadoRel: true
        }
    });
}

export async function buscarPublicacionPorIdDetallado(id: number, idUsuario?: number): Promise<any | null> {
    const publicacion = await prisma.publicacion.findUnique({
        where: { id_publicacion: id },
        include: {
            imagenes: SELECT_IMAGENES_RESUMEN,
            etiquetas: INCLUDE_ETIQUETAS_DETALLADAS,
            estadoRel: SELECT_ESTADO_RESUMEN,
            tipoPerfil: SELECT_TIPO_PERFIL_RESUMEN,
            usuario: SELECT_USUARIO_RESUMEN,
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
    orderBy.push({ [CAMPO_ORDEN[sort] ?? CAMPO_ORDEN.fecha]: order });

    const where: any = {};
    const idTipo = await resolverIdTipoPerfilPorNombre(tipo);
    if (idTipo !== undefined) where.tipo_publicacion = idTipo;

    const idEstado = await resolverIdEstadoPorNombre(estado);
    if (idEstado !== undefined) where.estado = idEstado;

    const [publicaciones, total] = await prisma.$transaction([

        prisma.publicacion.findMany({
            where,
            include: {
                imagenes: true,
                etiquetas: { include: { etiqueta: true } },
                estadoRel: SELECT_ESTADO_RESUMEN,

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

export async function buscarPublicacionesModeracion(
    options: FiltrosModeracionPublicaciones
): Promise<ResultadoBusquedaPublicacion> {
    const { page = 1, limit = 10, sort = "fecha", order = "desc", tipo, estado, q } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.PublicacionWhereInput = {};

    if (tipo) {
        const idTipo = await resolverIdTipoPerfilPorNombre(tipo);
        if (idTipo === undefined) return { publicaciones: [], total: 0 };
        where.tipo_publicacion = idTipo;
    }

    if (estado) {
        const idEstado = await resolverIdEstadoPorNombre(estado);
        if (idEstado === undefined) return { publicaciones: [], total: 0 };
        where.estado = idEstado;
    }

    if (q?.trim()) {
        const termino = q.trim();
        where.OR = [
            { titulo: { contains: termino, mode: "insensitive" } },
            { descripcion: { contains: termino, mode: "insensitive" } },
            { usuario: { nombre: { contains: termino, mode: "insensitive" } } },
            { usuario: { email_institucional: { contains: termino, mode: "insensitive" } } }
        ];
    }

    const orderBy: Prisma.PublicacionOrderByWithRelationInput[] = [
        { [CAMPO_ORDEN[sort] ?? CAMPO_ORDEN.fecha]: order },
    ];

    const [publicaciones, total] = await prisma.$transaction([
        prisma.publicacion.findMany({
            where,
            include: {
                imagenes: true,
                etiquetas: {
                    include: { etiqueta: true }
                },
                estadoRel: SELECT_ESTADO_RESUMEN,
                tipoPerfil: SELECT_TIPO_PERFIL_RESUMEN,
                usuario: SELECT_USUARIO_RESUMEN
            },
            orderBy,
            skip,
            take: limit
        }),
        prisma.publicacion.count({ where })
    ]);

    return { publicaciones, total };
}

export async function guardarPublicacion(
    data: Prisma.PublicacionCreateInput,
    idsEtiquetas: number[] = [],
): Promise<Publicacion> {
    return prisma.$transaction(async (tx) => {
        const publicacion = await tx.publicacion.create({ data });
        if (idsEtiquetas.length > 0) {
            await tx.publicacionEtiqueta.createMany({
                data: idsEtiquetas.map((idEtiqueta) => ({
                    id_publicacion: publicacion.id_publicacion,
                    id_etiqueta: idEtiqueta,
                })),
                skipDuplicates: true,
            });
        }
        return publicacion;
    });
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
    const idEstado = await resolverIdEstadoPorNombre(estado);
    if (idEstado !== undefined) where.estado = idEstado;

    return prisma.publicacion.findMany({
        where,
        include: {
            imagenes: true,
            etiquetas: { include: { etiqueta: true } },
            estadoRel: SELECT_ESTADO_RESUMEN,
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
            estadoRel: SELECT_ESTADO_RESUMEN,
            tipoPerfil: SELECT_TIPO_PERFIL_RESUMEN
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

export async function reemplazarEtiquetasPublicacion(
    idPublicacion: number,
    idsEtiquetas: number[]
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await tx.publicacionEtiqueta.deleteMany({
            where: { id_publicacion: idPublicacion },
        });

        if (idsEtiquetas.length > 0) {
            await tx.publicacionEtiqueta.createMany({
                data: idsEtiquetas.map((idEtiqueta) => ({
                    id_publicacion: idPublicacion,
                    id_etiqueta: idEtiqueta,
                })),
                skipDuplicates: true,
            });
        }
    });
}

export async function eliminarPublicacionConRelaciones(idPublicacion: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await tx.imagenPublicacion.deleteMany({ where: { id_publicacion: idPublicacion } });
        await tx.publicacionEtiqueta.deleteMany({ where: { id_publicacion: idPublicacion } });
        await tx.publicacion.delete({ where: { id_publicacion: idPublicacion } });
    });
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
            imagenes: SELECT_IMAGENES_RESUMEN,
            etiquetas: INCLUDE_ETIQUETAS_DETALLADAS,
            estadoRel: SELECT_ESTADO_RESUMEN,
            tipoPerfil: SELECT_TIPO_PERFIL_RESUMEN,
            usuario: SELECT_USUARIO_RESUMEN
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

        const etiquetas = options.etiquetas;

        // Grupos exclusivos
        const gruposEspeciales = [
            ["Compra", "Alquiler"],
            ["Producto", "Servicio"]
        ];

        // Obtener etiquetas especiales desde BD
        const etiquetasEspeciales = await prisma.etiqueta.findMany({
            where: {
                nombre: {
                    in: gruposEspeciales.flat()
                }
            },
            select: {
                id_etiqueta: true,
                nombre: true
            }
        });

        const condicionesEtiquetas: any[] = [];

        // IDs especiales
        const idsEspeciales = etiquetasEspeciales.map(
            (e) => e.id_etiqueta
        );

        // Etiquetas normales
        const etiquetasNormales = etiquetas.filter(
            (id) => !idsEspeciales.includes(id)
        );

        // Etiquetas normales → OR clásico
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

        // Procesar grupos exclusivos
        for (const grupo of gruposEspeciales) {

            const etiquetasGrupo = etiquetasEspeciales.filter(
                (e) => grupo.includes(e.nombre)
            );

            const seleccionadas = etiquetasGrupo.filter(
                (e) => etiquetas.includes(e.id_etiqueta)
            );

            // SOLO una seleccionada → aplicar filtro
            if (seleccionadas.length === 1) {

                condicionesEtiquetas.push({
                    etiquetas: {
                        some: {
                            id_etiqueta: seleccionadas[0].id_etiqueta
                        }
                    }
                });
            }

            // Si vienen ambas o ninguna → ignorar
        }

        if (condicionesEtiquetas.length > 0) {
            where.AND = condicionesEtiquetas;
        }
    }
    // 4. Filtro por tipo de publicación
    if (options.tipo) {
        const idTipo = await resolverIdTipoPerfilPorNombre(options.tipo);
        if (idTipo === undefined) return []; // Tipo no existe, devolver vacío
        where.tipo_publicacion = idTipo;
    }
    // 5. Filtro por estado
    const idEstado = await resolverIdEstadoPorNombre(options.estado);
    if (idEstado !== undefined) where.estado = idEstado;
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
