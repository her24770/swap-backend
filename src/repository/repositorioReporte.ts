import { Prisma, Reporte, PalabraRestringida, MotivoReporte, Estado } from "@prisma/client";
import { ReportePaginationOptions, ReporteTableData, ResultadoBusquedaReporte, motivosReporte } from "../modelo/schemaReporte";
import prisma from "../persistencia/prismaClient";

// ─────────────────────────────────────────────
// Reporte
// ─────────────────────────────────────────────

// Función auxiliar para transformar el reporte a formato de tabla
function transformarReporteParaTabla(reporte: any): ReporteTableData {
    // Determinar el tipo basado en qué ID tiene
    const tipo = reporte.id_publicacion ? 'Publicación' : 'Mensaje';

    return {
        id_reporte: reporte.id_reporte,
        tipo: tipo,
        fecha: reporte.fecha,
        estado: reporte.estadoRel?.estado || 'Desconocido',
        emisor: {
            nombre: reporte.emisor.nombre,
            email_institucional: reporte.emisor.email_institucional,
            url_foto_perfil: reporte.emisor.url_foto_perfil
        },
        receptor: {
            nombre: reporte.receptor.nombre,
            email_institucional: reporte.receptor.email_institucional,
            url_foto_perfil: reporte.receptor.url_foto_perfil
        }
    };
}

export async function buscarReportePorId(id: number): Promise<Reporte | null> {
    return prisma.reporte.findUnique({
        where: { id_reporte: id },
        include: {
            emisor: { select: { id_usuario: true, nombre: true, email_institucional: true } },
            receptor: { select: { id_usuario: true, nombre: true, email_institucional: true } },
            motivoRel: true,
            estadoRel: true,
            publicacion: {
                select: {
                    id_publicacion: true,
                    titulo: true,
                    estadoRel: {
                        select: {
                            estado: true
                        }
                    }
                }
            },
            mensaje: {
                select: {
                    id_mensaje: true,
                    mensaje: true,
                    estadoRel: {
                        select: {
                            estado: true
                        }
                    }
                }
            },
            moderador: {
                select: {
                    id_moderador: true,
                    usuario: true
                }
            }
        },
    });
}

export async function buscarReportesPaginados(
    options: ReportePaginationOptions
): Promise<ResultadoBusquedaReporte> {
    const { 
        page = 1, 
        limit = 10, 
        sort = 'fecha', 
        order = 'desc',
        estado = 'todos',
        motivo,
        tipo = 'todos',
        idReceptor,
        idEmisor
    } = options;

    const skip = (page - 1) * limit;

    // Construir ordenamiento
    const orderBy: any[] = [];

    switch (sort) {
        case 'fecha':
            orderBy.push({ fecha: order });
            break;
        case 'estado':
            orderBy.push({ estadoRel: { estado: order } });
            break;
        default:
            orderBy.push({ fecha: order });
            break;
    }

    // Construir filtros
    const where: any = {};

    // Filtro por estado (nombre)
    if (estado === 'pendiente' || estado === 'resuelto' || estado === 'rechazado') {
        where.estadoRel = { estado };
    }

    // Filtro por motivo (usando el índice del array)
    if (motivo) {
        const motivoIndex = motivosReporte.indexOf(motivo as any);
        if (motivoIndex !== -1) {
            // El ID del motivo es el índice + 1 (asumiendo que empiezan en 1)
            where.motivo = motivoIndex + 1;
        }
    }

    // Filtro por tipo (publicación o mensaje)
    if (tipo === 'publicacion') {
        where.id_publicacion = { not: null };
        where.id_mensaje = null;
    } else if (tipo === 'mensaje') {
        where.id_mensaje = { not: null };
        where.id_publicacion = null;
    }
    // Si es 'todos', no filtramos por tipo

    // Filtro por receptor
    if (idReceptor) {
        where.id_receptor = idReceptor;
    }

    // Filtro por emisor
    if (idEmisor) {
        where.id_emisor = idEmisor;
    }

    // Ejecutar consultas en transacción
    const [reportes, total] = await prisma.$transaction([

        prisma.reporte.findMany({
            where,
            select: {
                id_reporte: true,
                fecha: true,
                id_publicacion: true,
                id_mensaje: true,
                motivoRel: {
                    select: {
                        id_motivo: true,
                        motivo: true
                    }
                },
                estadoRel: {
                    select: {
                        id_estado: true,
                        estado: true
                    }
                },
                emisor: {
                    select: {
                        nombre: true,
                        email_institucional: true,
                        url_foto_perfil: true
                    }
                },
                receptor: {
                    select: {
                        nombre: true,
                        email_institucional: true,
                        url_foto_perfil: true
                    }
                }
            },
            orderBy,
            skip,
            take: limit
        }),

        prisma.reporte.count({ where })

    ]);

    const reportesMapeados = reportes.map(transformarReporteParaTabla);
    const totalPages = Math.ceil(total / limit);

    return {
        reportes: reportesMapeados,
        total,
        page,
        limit,
        totalPages
    };
}


export async function repoActualizarEstadoReporte(id: number, id_estado: number): Promise<Reporte> {
    return prisma.reporte.update({
        where: { id_reporte: id },
        data: { estado: id_estado },
    });
}   

export async function buscarEstadoReportePorNombre(estado: string): Promise<Estado | null> {
    return prisma.estado.findUnique({
        where: { estado },
    });
}   

export async function buscarReportesPorReceptor(idReceptor: number): Promise<Reporte[]> {
    return prisma.reporte.findMany({
        where: { id_receptor: idReceptor },
        include: { motivoRel: true, estadoRel: true },
        orderBy: { fecha: "desc" },
    });
}

export async function buscarReportesPorEmisor(idEmisor: number): Promise<Reporte[]> {
    return prisma.reporte.findMany({
        where: { id_emisor: idEmisor },
        include: { motivoRel: true, estadoRel: true },
        orderBy: { fecha: "desc" },
    });
}

export async function guardarReporte(data: Prisma.ReporteCreateInput): Promise<Reporte> {
    return prisma.reporte.create({ data });
}

export async function obtenerOCrearMotivoReportePorNombre(motivo: string): Promise<MotivoReporte> {
    return prisma.motivoReporte.upsert({
        where: { motivo },
        update: {},
        create: { motivo },
    });
}

export async function actualizarReporte(
    id: number,
    data: Prisma.ReporteUpdateInput
): Promise<Reporte> {
    return prisma.reporte.update({ where: { id_reporte: id }, data });
}

export async function eliminarReporte(id: number): Promise<Reporte> {
    return prisma.reporte.delete({ where: { id_reporte: id } });
}

// ─────────────────────────────────────────────
// PalabraRestringida
// ─────────────────────────────────────────────

export async function buscarPalabraRestringidaPorId(
    id: number
): Promise<PalabraRestringida | null> {
    return prisma.palabraRestringida.findUnique({ where: { id_palabra: id } });
}

export async function buscarTodasLasPalabrasRestringidas(): Promise<PalabraRestringida[]> {
    return prisma.palabraRestringida.findMany({ orderBy: { palabra: "asc" } });
}

export async function palabraEstaRestringida(palabra: string): Promise<boolean> {
    const resultado = await prisma.palabraRestringida.findUnique({
        where: { palabra: palabra.toLowerCase() },
    });
    return resultado !== null;
}

export async function guardarPalabraRestringida(
    data: Prisma.PalabraRestringidaCreateInput
): Promise<PalabraRestringida> {
    return prisma.palabraRestringida.create({ data });
}

export async function actualizarPalabraRestringida(
    id: number,
    data: Prisma.PalabraRestringidaUpdateInput
): Promise<PalabraRestringida> {
    return prisma.palabraRestringida.update({ where: { id_palabra: id }, data });
}

export async function eliminarPalabraRestringida(id: number): Promise<PalabraRestringida> {
    return prisma.palabraRestringida.delete({ where: { id_palabra: id } });
}
