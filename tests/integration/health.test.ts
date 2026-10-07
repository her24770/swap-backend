import request from "supertest";
import { describe, it, vi } from "vitest";
import app from "../../src/app";

vi.mock("../../src/autenticacion/rateLimiter", () => ({
    rateLimitGlobal: (_req: unknown, _res: unknown, next: () => void) => next(),
    RateLimiterNoDisponibleError: class RateLimiterNoDisponibleError extends Error {},
}));

describe("Endpoint health", () => {
    it("debe devolver un estado 200", async () => {
        await request(app).get("/api/health").expect(200);
    });
});
