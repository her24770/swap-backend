import { TipoModerador } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

/**
 * Obtener todos los tipos de moderador
 */
export async function obtenerTiposModerador(): Promise<TipoModerador[] | []> {
    return await prisma.tipoModerador.findMany();
}

/**
 * Obtener un tipo de moderador por su id
 */
export async function obtenerTipoModeradorPorId(id: number): Promise<TipoModerador | null> {
    return await prisma.tipoModerador.findUnique({ where: { id_tipo_moderador: id } });
}

/**
 * Obtener un tipo de moderador por su nombre
 */
export async function obtenerTipoModeradorPorNombre(nombre: string | undefined): Promise<TipoModerador | null> {
    if (!nombre || nombre === "") return null;
    return await prisma.tipoModerador.findUnique({ where: { tipo_moderador: nombre } });
}
