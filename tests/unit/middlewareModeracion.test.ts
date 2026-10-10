import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analizarTexto } from "../../src/servicios/servicioModeracionTexto";
import { analizarImagen } from "../../src/servicios/servicioModeracionImagen";
import { errorResponse } from "../../src/servicios/Response";
import { escribirLog } from "../../src/observabilidad/logger";
import { moderarImagenes, moderarTexto } from "../../src/autenticacion/middlewareModeracion";

vi.mock("../../src/servicios/servicioModeracionTexto", () => ({ analizarTexto: vi.fn() }));
vi.mock("../../src/servicios/servicioModeracionImagen", () => ({ analizarImagen: vi.fn() }));
vi.mock("../../src/servicios/Response", () => ({ errorResponse: vi.fn() }));
vi.mock("../../src/observabilidad/logger", () => ({ escribirLog: vi.fn() }));

describe("middlewareModeracion - Política Fail-Closed (OWASP A10)", () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.restoreAllMocks());

    it("ante caída del proveedor de texto, registra evento operativo y marca moderacionPendiente para revisión manual (fail-closed)", async () => {
        vi.mocked(analizarTexto).mockRejectedValue(new Error("OpenAI Moderation timeout"));
        const req: any = { body: { titulo: "Curso de cálculo", descripcion: "Libro usado" }, originalUrl: "/api/v1/publicacion" };
        const next = vi.fn();

        await moderarTexto(["titulo", "descripcion"])(req, {} as any, next);

        // Fail-Closed: no aborta la petición con 503; continúa y marca para revisión
        expect(req.moderacionPendiente).toBe(true);
        expect(req.motivoModeracionPendiente).toContain("OpenAI");
        expect(next).toHaveBeenCalledOnce();
        expect(errorResponse).not.toHaveBeenCalled();

        // Registra el evento en observabilidad
        expect(escribirLog).toHaveBeenCalledWith("warn", "moderation.provider_failed", expect.objectContaining({
            providerType: "text",
        }));
    });

    it("bloquea con 422 si el texto es explícitamente infractor", async () => {
        vi.mocked(analizarTexto).mockResolvedValue({ flagged: true, categorias: ["violence"] });
        const req: any = { body: { titulo: "Contenido no permitido" } };
        const next = vi.fn();

        await moderarTexto(["titulo"])(req, {} as any, next);

        expect(errorResponse).toHaveBeenCalledWith(expect.anything(), expect.any(String), 422);
        expect(next).not.toHaveBeenCalled();
    });

    it("ante caída de AWS Rekognition, registra evento y marca moderacionPendiente para revisión manual (fail-closed)", async () => {
        vi.mocked(analizarImagen).mockRejectedValue(new Error("AWS Rekognition no disponible"));
        const req: any = { file: { buffer: Buffer.from("imagen") }, originalUrl: "/api/v1/publicacion" };
        const next = vi.fn();

        await moderarImagenes(req, {} as any, next);

        expect(req.moderacionPendiente).toBe(true);
        expect(req.motivoModeracionPendiente).toContain("Rekognition");
        expect(next).toHaveBeenCalledOnce();
        expect(errorResponse).not.toHaveBeenCalled();

        expect(escribirLog).toHaveBeenCalledWith("warn", "moderation.provider_failed", expect.objectContaining({
            providerType: "image",
        }));
    });

    it("bloquea las imágenes explícitamente infractoras con 422", async () => {
        vi.mocked(analizarImagen).mockResolvedValue({ flagged: true, etiquetas: ["Violence"] });
        const next = vi.fn();

        await moderarImagenes({ files: [{ buffer: Buffer.from("imagen") }] } as any, {} as any, next);

        expect(errorResponse).toHaveBeenCalledWith(expect.anything(), expect.any(String), 422);
        expect(next).not.toHaveBeenCalled();
    });

    it("continúa normalmente cuando el texto y las imágenes son aprobadas", async () => {
        vi.mocked(analizarTexto).mockResolvedValue({ flagged: false, categorias: [] });
        vi.mocked(analizarImagen).mockResolvedValue({ flagged: false, etiquetas: [] });
        const req: any = { body: { titulo: "Publicación aprobada" }, files: [{ buffer: Buffer.from("imagen") }] };
        const next = vi.fn();

        await moderarTexto(["titulo"])(req, {} as any, next);
        await moderarImagenes(req, {} as any, next);

        expect(req.moderacionPendiente).toBeUndefined();
        expect(next).toHaveBeenCalledTimes(2);
        expect(errorResponse).not.toHaveBeenCalled();
    });
});
