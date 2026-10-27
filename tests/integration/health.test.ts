import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";

const dependencias = vi.hoisted(() => ({ comprobar: vi.fn() }));

vi.mock("../../src/observabilidad/saludDependencias", () => ({
    comprobarDependencias: dependencias.comprobar,
}));

vi.mock("../../src/autenticacion/rateLimiter", () => ({
    rateLimitGlobal: (_req: unknown, _res: unknown, next: () => void) => next(),
    RateLimiterNoDisponibleError: class RateLimiterNoDisponibleError extends Error {},
}));

describe("Endpoint health", () => {
    afterEach(() => {
        delete process.env.APP_VERSION;
        vi.clearAllMocks();
    });

    it("responde en menos de 200 ms cuando Postgres y Redis están disponibles", async () => {
        process.env.APP_VERSION = "v1.2.3";
        dependencias.comprobar.mockResolvedValue([]);
        const inicio = performance.now();

        const respuesta = await request(app).get("/api/health").expect(200);

        expect(respuesta.body).toEqual({ status: "ok", version: "v1.2.3" });
        expect(performance.now() - inicio).toBeLessThan(200);
    });

    it.each(["postgres", "redis"])("responde 503 sin datos sensibles cuando falla %s", async componente => {
        dependencias.comprobar.mockResolvedValue([componente]);

        const respuesta = await request(app).get("/api/health").expect(503);

        expect(respuesta.body).toEqual({
            status: "unavailable",
            version: "development",
            components: [componente],
        });
    });
});
