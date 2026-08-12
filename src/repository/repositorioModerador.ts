import prisma from "../persistencia/prismaClient";

export async function buscarModeradorPorUsuario(usuario: string) {
    return prisma.moderador.findUnique({ where: { usuario }, include: { tipoRel: true } });
}

export async function buscarModeradorPorId(id: number) {
    return prisma.moderador.findUnique({ where: { id_moderador: id }, include: { tipoRel: true } });
}
