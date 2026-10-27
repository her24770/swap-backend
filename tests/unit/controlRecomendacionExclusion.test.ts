import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    obtenerRecomendacionesGlobales,
    obtenerRecomendacionesPersonalizadas,
} from "../../src/controlador/controlRecomendacion";
import { generarRecomendaciones, mergearListasGrupo } from "../../src/servicios/servicioRecomendacion";
import { obtenerTop2PadresUsuario } from "../../src/repository/repositorioRecomendacion";
import { buscarPublicacionesPorIdsDetallado } from "../../src/repository/repositorioPublicacion";
import redisClient from "../../src/persistencia/redisClient";

vi.mock("../../src/servicios/servicioRecomendacion", () => ({
    generarRecomendaciones: vi.fn(),
    mergearListasGrupo: vi.fn(),
}));
vi.mock("../../src/repository/repositorioTipoPerfil", () => ({ obtenerTipoPerfilPorNombre: vi.fn() }));
vi.mock("../../src/repository/repositorioRecomendacion", () => ({ obtenerTop2PadresUsuario: vi.fn() }));
vi.mock("../../src/repository/repositorioPublicacion", () => ({ buscarPublicacionesPorIdsDetallado: vi.fn() }));
vi.mock("../../src/autenticacion/eventoRecomendacion", () => ({
    registrarInteraccionPublicacion: vi.fn(),
    registrarFavoritasUsuario: vi.fn(),
    eliminarFavoritasUsuario: vi.fn(),
    TIPOS_EVENTO_VALIDOS: [],
}));
vi.mock("../../src/persistencia/redisClient", () => ({ default: { get: vi.fn(), set: vi.fn() } }));

function respuesta() {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
}

const requestUsuario = { params: {}, usuario: { sub: "7" } } as unknown as Request;
const next = vi.fn() as NextFunction;

describe("recomendaciones sin publicaciones propias", () => {
    beforeEach(() => vi.clearAllMocks());

    it("conserva recomendaciones globales ajenas y excluye las del usuario", async () => {
        vi.mocked(generarRecomendaciones).mockResolvedValue([
            { id_publicacion: 1, id_usuario: 7 },
            { id_publicacion: 2, id_usuario: 8 },
        ] as never);
        const res = respuesta();

        await obtenerRecomendacionesGlobales(requestUsuario, res as unknown as Response, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            data: [{ id_publicacion: 2, id_usuario: 8 }],
        }));
    });

    it("responde 404 cuando las recomendaciones globales son solo propias", async () => {
        vi.mocked(generarRecomendaciones).mockResolvedValue([{ id_publicacion: 1, id_usuario: 7 }] as never);
        const res = respuesta();

        await obtenerRecomendacionesGlobales(requestUsuario, res as unknown as Response, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it("filtra las recomendaciones personalizadas después de recuperar sus detalles", async () => {
        vi.mocked(obtenerTop2PadresUsuario).mockResolvedValue([3]);
        vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify([
            { id_publicacion: 1, score: 9 },
            { id_publicacion: 2, score: 7 },
        ]));
        vi.mocked(mergearListasGrupo).mockReturnValue([
            { id_publicacion: 1, score: 9 },
            { id_publicacion: 2, score: 7 },
        ]);
        vi.mocked(buscarPublicacionesPorIdsDetallado).mockResolvedValue([
            { id_publicacion: 1, id_usuario: 7 },
            { id_publicacion: 2, id_usuario: 8 },
        ]);
        const res = respuesta();

        await obtenerRecomendacionesPersonalizadas(requestUsuario, res as unknown as Response, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            data: [{ id_publicacion: 2, id_usuario: 8, score: 7 }],
        }));
    });
});
