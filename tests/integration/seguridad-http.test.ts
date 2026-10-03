import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("regresiones de seguridad HTTP", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("BG-19: entrega cabeceras defensivas en las dos versiones de la API", async () => {
        const { default: app } = await import("../../src/app");

        for (const ruta of ["/api/health", "/api/v1/health"]) {
            const respuesta = await request(app).get(ruta).expect(200);
            expect(respuesta.headers["content-security-policy"]).toContain("default-src 'none'");
            expect(respuesta.headers["strict-transport-security"]).toBeTruthy();
            expect(respuesta.headers["x-content-type-options"]).toBe("nosniff");
            expect(respuesta.headers["x-frame-options"]).toBeTruthy();
            expect(respuesta.headers["referrer-policy"]).toBeTruthy();
        }
    });

    it("BG-20: no monta Swagger ni OpenAPI bajo ningun prefijo en produccion", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.resetModules();
        const { default: appProduccion } = await import("../../src/app");

        for (const ruta of [
            "/api/docs/",
            "/api/openapi.json",
            "/api/v1/docs/",
            "/api/v1/openapi.json",
        ]) {
            await request(appProduccion).get(ruta).expect(404);
        }
    });
});
