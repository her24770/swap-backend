import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "../../src/persistencia/prismaClient";
import {
    buscarPublicacionesPaginadas,
    buscarPublicacionesPorFiltros,
} from "../../src/repository/repositorioPublicacion";

vi.mock("../../src/persistencia/prismaClient", () => ({
    default: {
        $transaction: vi.fn(),
        publicacion: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
        estado: {
            findUnique: vi.fn(),
        },
        tipoPerfil: {
            findUnique: vi.fn(),
        },
        etiqueta: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("../../src/repository/repositorioEstado", () => ({
    obtenerEstadoPorNombre: vi.fn().mockResolvedValue({ id_estado: 1, estado: "activo" }),
}));

vi.mock("../../src/repository/repositorioTipoPerfil", () => ({
    obtenerTipoPerfilPorNombre: vi.fn().mockResolvedValue({ id_tipo_perfil: 2, tipo_perfil: "material" }),
}));

describe("Exclusión de publicaciones del usuario autenticado (Unitario)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("buscarPublicacionesPaginadas", () => {
        it("agrega where.id_usuario = { not: idUsuario } cuando idUsuario está presente", async () => {
            vi.mocked(prisma.$transaction).mockResolvedValue([
                [{ id_publicacion: 10, id_usuario: 99, usuarioPublicacions: [] }],
                1,
            ] as any);

            const res = await buscarPublicacionesPaginadas({ page: 1, limit: 10 }, 42);

            expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled();
            // Verificar que findMany recibió la cláusula where con id_usuario: { not: 42 }
            expect(vi.mocked(prisma.publicacion.findMany)).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id_usuario: { not: 42 },
                    }),
                })
            );
            // Verificar que count recibió la misma cláusula where
            expect(vi.mocked(prisma.publicacion.count)).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id_usuario: { not: 42 },
                    }),
                })
            );
            expect(res.total).toBe(1);
            expect(res.publicaciones).toHaveLength(1);
        });

        it("no agrega filtro de id_usuario si idUsuario es undefined", async () => {
            vi.mocked(prisma.$transaction).mockResolvedValue([
                [{ id_publicacion: 10, id_usuario: 42, usuarioPublicacions: [] }],
                1,
            ] as any);

            await buscarPublicacionesPaginadas({ page: 1, limit: 10 });

            expect(vi.mocked(prisma.publicacion.findMany)).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.not.objectContaining({
                        id_usuario: expect.anything(),
                    }),
                })
            );
            expect(vi.mocked(prisma.publicacion.count)).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.not.objectContaining({
                        id_usuario: expect.anything(),
                    }),
                })
            );
        });
    });

    describe("buscarPublicacionesPorFiltros", () => {
        it("agrega where.id_usuario = { not: idUsuario } cuando idUsuario está presente", async () => {
            vi.mocked(prisma.publicacion.findMany).mockResolvedValue([
                { id_publicacion: 11, id_usuario: 88 } as any,
            ]);

            const res = await buscarPublicacionesPorFiltros({ precio_min: 10 }, 55);

            expect(vi.mocked(prisma.publicacion.findMany)).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id_usuario: { not: 55 },
                        precio: expect.objectContaining({ gte: 10 }),
                    }),
                })
            );
            expect(res).toHaveLength(1);
        });

        it("no agrega where.id_usuario cuando idUsuario no se proporciona", async () => {
            vi.mocked(prisma.publicacion.findMany).mockResolvedValue([
                { id_publicacion: 11, id_usuario: 55 } as any,
            ]);

            await buscarPublicacionesPorFiltros({ precio_min: 10 });

            expect(vi.mocked(prisma.publicacion.findMany)).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.not.objectContaining({
                        id_usuario: expect.anything(),
                    }),
                })
            );
        });
    });
});
