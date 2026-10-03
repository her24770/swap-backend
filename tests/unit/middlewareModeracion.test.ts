import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analizarTexto } from "../../src/servicios/servicioModeracionTexto";
import { analizarImagen } from "../../src/servicios/servicioModeracionImagen";
import { errorResponse } from "../../src/servicios/Response";
import { moderarImagenes, moderarTexto } from "../../src/autenticacion/middlewareModeracion";

vi.mock("../../src/servicios/servicioModeracionTexto", () => ({ analizarTexto: vi.fn() }));
vi.mock("../../src/servicios/servicioModeracionImagen", () => ({ analizarImagen: vi.fn() }));
vi.mock("../../src/servicios/Response", () => ({ errorResponse: vi.fn() }));

describe("middlewareModeracion", () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.restoreAllMocks());

    it("bloquea el texto cuando falla el proveedor", async () => {
        vi.mocked(analizarTexto).mockRejectedValue(new Error("proveedor caído"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        const next = vi.fn();

        await moderarTexto(["titulo"])({ body: { titulo: "publicación" } } as any, {} as any, next);

        expect(errorResponse).toHaveBeenCalledWith(expect.anything(), expect.any(String), 503);
        expect(next).not.toHaveBeenCalled();
    });

    it("bloquea las imágenes cuando falla el proveedor", async () => {
        vi.mocked(analizarImagen).mockRejectedValue(new Error("proveedor caído"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        const next = vi.fn();

        await moderarImagenes({ file: { buffer: Buffer.from("imagen") } } as any, {} as any, next);

        expect(errorResponse).toHaveBeenCalledWith(expect.anything(), expect.any(String), 503);
        expect(next).not.toHaveBeenCalled();
    });

    it("bloquea las imágenes marcadas antes de publicar", async () => {
        vi.mocked(analizarImagen).mockResolvedValue({ flagged: true, etiquetas: ["Violence"] });
        const next = vi.fn();

        await moderarImagenes({ files: [{ buffer: Buffer.from("imagen") }] } as any, {} as any, next);

        expect(errorResponse).toHaveBeenCalledWith(expect.anything(), expect.any(String), 422);
        expect(next).not.toHaveBeenCalled();
    });

    it("continúa cuando todas las imágenes son aprobadas", async () => {
        vi.mocked(analizarImagen).mockResolvedValue({ flagged: false, etiquetas: [] });
        const next = vi.fn();

        await moderarImagenes({ files: [{ buffer: Buffer.from("imagen") }] } as any, {} as any, next);

        expect(next).toHaveBeenCalledOnce();
        expect(errorResponse).not.toHaveBeenCalled();
    });
});
