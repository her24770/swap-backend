import { Etiqueta } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

export async function obtenerEtiquetasPorUsuario(idUsuario: number, includePadre: boolean = false): Promise<Etiqueta[] | []> {
    return await prisma.etiqueta.findMany({
        where:
            { usuarios: { some: { id_usuario: idUsuario } } },
        include: { padre: includePadre },
        orderBy: { nombre: "asc" }
    });
}

export async function obtenerEtiquetasPorPublicacion(idPublicacion: number, includePadre: boolean = false): Promise<Etiqueta[] | []> {
    return await prisma.etiqueta.findMany({
        where:
            { publicaciones: { some: { id_publicacion: idPublicacion } } },
        include: { padre: includePadre },
        orderBy: { nombre: "asc"}
    });
}

export async function obtenerTodasLasEtiquetas(): Promise<Etiqueta[]> {
    return await prisma.etiqueta.findMany({
        orderBy: { nombre: "asc" }
    });
}

/**
 * Obtiene los IDs de las etiquetas actuales de un usuario
 */
export async function obtenerIdsEtiquetasPorUsuario(idUsuario: number): Promise<number[]> {
    const relaciones = await prisma.usuarioEtiqueta.findMany({
        where: { id_usuario: idUsuario },
        select: { id_etiqueta: true }
    });
    return relaciones.map(r => r.id_etiqueta);
}

/**
 * Sincroniza las etiquetas de un usuario (agrega nuevas, elimina las que ya no están)
 */
export async function sincronizarEtiquetasUsuario(
    idUsuario: number,
    nuevasEtiquetasIds: number[]
): Promise<void> {
    // Obtener etiquetas actuales
    const idsActuales = await obtenerIdsEtiquetasPorUsuario(idUsuario);
    
    // Calcular diferencias
    const idsAEliminar = idsActuales.filter(id => !nuevasEtiquetasIds.includes(id));
    const idsAAgregar = nuevasEtiquetasIds.filter(id => !idsActuales.includes(id));
    
    // Ejecutar cambios en transacción
    await prisma.$transaction(async (tx) => {
        // Eliminar las que ya no están
        if (idsAEliminar.length > 0) {
            await tx.usuarioEtiqueta.deleteMany({
                where: {
                    id_usuario: idUsuario,
                    id_etiqueta: { in: idsAEliminar }
                }
            });
        }
        
        // Agregar las nuevas
        if (idsAAgregar.length > 0) {
            await tx.usuarioEtiqueta.createMany({
                data: idsAAgregar.map(id_etiqueta => ({
                    id_usuario: idUsuario,
                    id_etiqueta,
                    peso: 1
                })),
                skipDuplicates: true
            });
        }
    });
}

/**
 * Verifica que todas las etiquetas existan en la base de datos
 */
export async function verificarEtiquetasExisten(ids: number[]): Promise<boolean> {
    const etiquetas = await prisma.etiqueta.findMany({
        where: { id_etiqueta: { in: ids } },
        select: { id_etiqueta: true }
    });
    return etiquetas.length === ids.length;
}
