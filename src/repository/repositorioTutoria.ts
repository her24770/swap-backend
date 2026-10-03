import { Prisma, TiempoDisponible, Acuerdo } from "@prisma/client";
import { FiltrosTutorInput } from "../modelo/schemaUsuario";
import prisma from "../persistencia/prismaClient";

// ─────────────────────────────────────────────
// TiempoDisponible
// ─────────────────────────────────────────────

export async function buscarTiempoPorId(id: number): Promise<TiempoDisponible | null> {
    return prisma.tiempoDisponible.findUnique({ where: { id_tiempo: id } });
}

export async function buscarTiemposPorUsuario(idUsuario: number): Promise<TiempoDisponible[]> {
    return prisma.tiempoDisponible.findMany({
        where: { id_usuario: idUsuario },
        orderBy: { hora_inicio: "asc" } as any,
    });
}

export async function buscarTodosLosTiempos(): Promise<TiempoDisponible[]> {
    return prisma.tiempoDisponible.findMany({ orderBy: { hora_inicio: "asc" } as any });
}

export async function guardarTiempo(
    data: Prisma.TiempoDisponibleCreateInput
): Promise<TiempoDisponible> {
    return prisma.tiempoDisponible.create({ data });
}

export async function actualizarTiempo(
    id: number,
    data: Prisma.TiempoDisponibleUpdateInput
): Promise<TiempoDisponible> {
    return prisma.tiempoDisponible.update({ where: { id_tiempo: id }, data });
}

export async function eliminarTiempo(id: number): Promise<TiempoDisponible> {
    return prisma.tiempoDisponible.delete({ where: { id_tiempo: id } });
}

// ─────────────────────────────────────────────
// Acuerdo
// ─────────────────────────────────────────────

export async function buscarAcuerdoPorId(id: number): Promise<Acuerdo | null> {
    return prisma.acuerdo.findUnique({
        where: { id_acuerdo: id }
    });
}

export async function buscarAcuerdosPorUsuario(idUsuario: number): Promise<Acuerdo[]> {
    return prisma.acuerdo.findMany({
        where: { id_usuario: idUsuario },
        orderBy: { fecha_entrega: "asc" },
    });
}

export async function buscarTodosLosAcuerdos(): Promise<Acuerdo[]> {
    return prisma.acuerdo.findMany({
        orderBy: { fecha_entrega: "asc" },
    });
}

export async function guardarAcuerdo(data: Prisma.AcuerdoCreateInput): Promise<Acuerdo> {
    return prisma.acuerdo.create({ data });
}

export async function actualizarAcuerdo(
    id: number,
    data: Prisma.AcuerdoUpdateInput
): Promise<Acuerdo> {
    return prisma.acuerdo.update({ where: { id_acuerdo: id }, data });
}

export async function eliminarAcuerdo(id: number): Promise<Acuerdo> {
    return prisma.acuerdo.delete({ where: { id_acuerdo: id } });
}


//Busqueda de tutores filtrados
export async function buscarTutoresPorFiltros(
    options: FiltrosTutorInput
){

    const where: any = {};

    // ─────────────────────────────────────────────
    // 1. Filtro por calificación
    // ─────────────────────────────────────────────

    if (
        options.calificacion_min !== undefined ||
        options.calificacion_max !== undefined
    ) {

        where.calificacion = {};

        if (options.calificacion_min !== undefined) {
            where.calificacion.gte = options.calificacion_min;
        }

        if (options.calificacion_max !== undefined) {
            where.calificacion.lte = options.calificacion_max;
        }
    }

    // ─────────────────────────────────────────────
    // 2. Filtro por disponibilidad
    // ─────────────────────────────────────────────

    if (
        options.dias?.length ||
        options.hora_inicio ||
        options.hora_final
    ) {

        where.tiemposDisponibles = {
            some: {}
        };

        // Días
        if (options.dias?.length) {
            where.tiemposDisponibles.some.dia = {
                in: options.dias
            };
        }

        // Hora inicio
        if (options.hora_inicio) {
            where.tiemposDisponibles.some.hora_inicio = {
                lte: new Date(`1970-01-01T${options.hora_inicio}`)
            };
        }

        // Hora final
        if (options.hora_final) {
            where.tiemposDisponibles.some.hora_fin = {
                gte: new Date(`1970-01-01T${options.hora_final}`)
            };
        }
    }

    // ─────────────────────────────────────────────
    // 3. Construcción filtro publicaciones tutoría
    // ─────────────────────────────────────────────

    const wherePublicaciones: any = {};

    // Solo tutorías
    const tipoTutoria = await prisma.tipoPerfil.findUnique({
        where: {
            tipo_perfil: "tutoria"
        }
    });

    if (!tipoTutoria) {
        return [];
    }

    wherePublicaciones.tipo_publicacion =
        tipoTutoria.id_tipo_perfil;

    // Precio
    if (
        options.precio_min !== undefined ||
        options.precio_max !== undefined
    ) {

        wherePublicaciones.precio = {};

        if (options.precio_min !== undefined) {
            wherePublicaciones.precio.gte =
                options.precio_min;
        }

        if (options.precio_max !== undefined) {
            wherePublicaciones.precio.lte =
                options.precio_max;
        }
    }

    // ─────────────────────────────────────────────
    // 4. Etiquetas y grupos exclusivos
    // ─────────────────────────────────────────────

    if (options.etiquetas?.length) {

        const gruposEspeciales = [
            ["Presencial", "En Línea"]
        ];

        const etiquetasEspeciales =
            await prisma.etiqueta.findMany({
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

        const idsEspeciales =
            etiquetasEspeciales.map(
                (e) => e.id_etiqueta
            );

        // Etiquetas normales
        const etiquetasNormales =
            options.etiquetas.filter(
                (id) => !idsEspeciales.includes(id)
            );

        // OR normal
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

        // Grupos exclusivos
        for (const grupo of gruposEspeciales) {

            const etiquetasGrupo =
                etiquetasEspeciales.filter(
                    (e) => grupo.includes(e.nombre)
                );

            const seleccionadas =
                etiquetasGrupo.filter(
                    (e) =>
                        options.etiquetas?.includes(
                            e.id_etiqueta
                        )
                );

            // SOLO una seleccionada
            if (seleccionadas.length === 1) {

                condicionesEtiquetas.push({
                    etiquetas: {
                        some: {
                            id_etiqueta:
                                seleccionadas[0].id_etiqueta
                        }
                    }
                });
            }
        }

        if (condicionesEtiquetas.length > 0) {
            wherePublicaciones.AND =
                condicionesEtiquetas;
        }
    }

    // Usuarios con publicaciones compatibles
    where.publicaciones = {
        some: wherePublicaciones
    };

    // ─────────────────────────────────────────────
    // 5. Paginación
    // ─────────────────────────────────────────────

    const skip =
        ((options.page || 1) - 1) *
        (options.limit || 10);

    const take =
        options.limit || 10;

    // ─────────────────────────────────────────────
    // 6. Query final
    // ─────────────────────────────────────────────

    return prisma.usuario.findMany({

        where,

        select: {

            id_usuario: true,
            nombre: true,
            url_foto_perfil: true,
            descripcion: true,
            calificacion: true,

            tiemposDisponibles: true,

            publicaciones: {
                where: wherePublicaciones,

                include: {
                    etiquetas: {
                        include: {
                            etiqueta: true
                        }
                    },

                    imagenes: true
                }
            }
        },

        skip,
        take
    });
}