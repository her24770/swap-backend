import { CalificacionUsuario } from "@prisma/client";
import prisma from "../persistencia/prismaClient";
import { CrearCalificacionInput, EditarCalificacionInput } from "../modelo/schemaCalificacion";

/**
 * Registra una nueva calificación en la plataforma.
 * Mapea los IDs planos de Zod a las relaciones semánticas de Prisma.
 */
export async function crearCalificacion(data: CrearCalificacionInput): Promise<CalificacionUsuario> {
    return await prisma.calificacionUsuario.create({
        data: {
            calificacion: data.calificacion,
            UsuarioCalificado: {
                connect: { id_usuario: data.id_usuario_calificado },
            },
            UsuarioCalificador: {
                connect: { id_usuario: data.id_usuario_calificador },
            },
        },
    });
}

/**
 * Modifica el número de estrellas de una calificación existente.
 */
export async function actualizarCalificacion(
    idCalificacion: number, 
    data: EditarCalificacionInput 
): Promise<CalificacionUsuario> {
    return await prisma.calificacionUsuario.update({
        where: {
            id_calificacion_usuario: idCalificacion
        },
        data: {
            calificacion: data.calificacion
        }
    });
}

/**
 * Busca una calificación específica por su ID único.
 */
export async function buscarCalificacionPorId(idCalificacion: number): Promise<CalificacionUsuario | null> {
    return await prisma.calificacionUsuario.findUnique({
        where: {
            id_calificacion_usuario: idCalificacion
        }
    });
}

/**
 * Verifica si un usuario ya calificó a otro anteriormente.
 */
export async function verificarCalificacionExistente(
    idCalificador: number,
    idCalificado: number
): Promise<CalificacionUsuario | null> {
    return await prisma.calificacionUsuario.findFirst({
        where: {
            id_usuario_calificador: idCalificador,
            id_usuario_calificado: idCalificado,
        },
    });
}

/**
 * Obtiene todas las calificaciones recibidas por un usuario específico,
 */
export async function buscarCalificacionesPorUsuario(idUsuarioCalificado: number) {
    return await prisma.calificacionUsuario.findMany({
        where: {
            id_usuario_calificado: idUsuarioCalificado,
        },
        include: {
            UsuarioCalificador: {
                select: {
                    id_usuario: true,
                    nombre: true,
                    url_foto_perfil: true,
                },
            },
        },
        orderBy: {
            fecha_calificacion: "desc",
        },
    });
}

/**
 * Calcula el promedio de estrellas de un usuario y cuenta el total de votos.
 */
export async function calcularPromedioCalificacion(idUsuarioCalificado: number): Promise<{ promedio: number; total: number }> {
    const resultado = await prisma.calificacionUsuario.aggregate({
        where: {
            id_usuario_calificado: idUsuarioCalificado,
        },
        _avg: {
            calificacion: true,
        },
        _count: {
            id_calificacion_usuario: true,
        },
    });

    return {
        promedio: resultado._avg.calificacion ? parseFloat(resultado._avg.calificacion.toFixed(2)) : 0,
        total: resultado._count.id_calificacion_usuario,
    };
}


