import { Prisma } from "@prisma/client";
import prisma from "../persistencia/prismaClient";

export async function buscarModeradorPorUsuario(usuario: string) {
    return prisma.moderador.findUnique({ where: { usuario }, include: { tipoRel: true } });
}

export async function buscarModeradorPorId(id: number) {
    return prisma.moderador.findUnique({ where: { id_moderador: id }, include: { tipoRel: true } });
}

export async function buscarTodosLosModeradores() {
    return prisma.moderador.findMany({ include: { tipoRel: true }, orderBy: { usuario: "asc" } });
}

export async function guardarModerador(data: Prisma.ModeradorCreateInput) {
    return prisma.moderador.create({ data, include: { tipoRel: true } });
}

export async function actualizarModerador(id: number, data: Prisma.ModeradorUpdateInput) {
    return prisma.moderador.update({ where: { id_moderador: id }, data, include: { tipoRel: true } });
}

export async function eliminarModerador(id: number) {
    return prisma.moderador.delete({ where: { id_moderador: id } });
}

export async function contarModeradoresPorTipo(idTipoModerador: number) {
    return prisma.moderador.count({ where: { id_tipo_moderador: idTipoModerador } });
}
