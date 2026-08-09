import { Moderador } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

export async function buscarModeradorPorUsuario(usuario: string): Promise<Moderador | null> {
    return prisma.moderador.findUnique({ where: { usuario } });
}

export async function buscarModeradorPorId(id: number): Promise<Moderador | null> {
    return prisma.moderador.findUnique({ where: { id_moderador: id } });
}
