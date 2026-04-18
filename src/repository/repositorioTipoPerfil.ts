import { TipoPerfil } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

/**
 * Obtener todos los tipos de perfil
 */
export async function obtenerTiposPerfil(): Promise<TipoPerfil[] | []> {
    return await prisma.tipoPerfil.findMany();
}

/**
 * Obtener un tipo de perfil por su id
 */
export async function obtenerTipoPerfilPorId(id: number): Promise<TipoPerfil | null> {
    return await prisma.tipoPerfil.findUnique({ where: { id_tipo_perfil: id } });
}

/**
 * Obtener un tipo de perfil por su nombre
 */
export async function obtenerTipoPerfilPorNombre(nombre: string | undefined): Promise<TipoPerfil | null> {
    if (!nombre || nombre === "") return null;
    return await prisma.tipoPerfil.findUnique({ where: { tipo_perfil: nombre } });
}