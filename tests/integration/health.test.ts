import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";

vi.mock("../../src/autenticacion/rateLimiter", () => ({
    rateLimitGlobal: (_req: unknown, _res: unknown, next: () => void) => next(),
    RateLimiterNoDisponibleError: class RateLimiterNoDisponibleError extends Error {},
}));

describe("Endpoint health", () => {
    afterEach(() => delete process.env.APP_VERSION);

    it("expone la versión inyectada durante el build", async () => {
        process.env.APP_VERSION = "v1.2.3";

        const respuesta = await request(app).get("/api/health").expect(200);

        expect(respuesta.body).toEqual({ status: "ok", version: "v1.2.3" });
    });
});
