import { Estado } from "@prisma/client";
import prisma from "../persistencia/prismaClient"

/**
 Obtener todos los estados
 */

export async function obtenerEstados(): Promise<Estado[] | []> {
    return await prisma.estado.findMany();
}

/**
 * Obtener un estado por su id
 */
export async function obtenerEstadoPorId(id: number): Promise<Estado | null> {
    return await prisma.estado.findUnique({ where: { id_estado: id } });
}

export async function obtenerEstadoPorNombre(nombre: string): Promise<Estado | null> {
    return await prisma.estado.findUnique({ where: { estado: nombre } });
}