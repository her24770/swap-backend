import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({ query: vi.fn(), ping: vi.fn() }));

vi.mock("../../src/persistencia/prismaClient", () => ({
    default: { $queryRaw: dependencias.query },
}));
vi.mock("../../src/persistencia/redisClient", () => ({
    default: { ping: dependencias.ping },
}));

import { comprobarDependencias } from "../../src/observabilidad/saludDependencias";

describe("comprobarDependencias", () => {
    beforeEach(() => {
        dependencias.query.mockReset().mockResolvedValue([{ "?column?": 1 }]);
        dependencias.ping.mockReset().mockResolvedValue("PONG");
    });

    it("ejecuta SELECT 1 y PING en paralelo", async () => {
        await expect(comprobarDependencias()).resolves.toEqual([]);
        expect(dependencias.query).toHaveBeenCalledOnce();
        expect(dependencias.ping).toHaveBeenCalledOnce();
    });

    it("identifica cada dependencia que falla", async () => {
        dependencias.query.mockRejectedValue(new Error("secreto postgres"));
        dependencias.ping.mockRejectedValue(new Error("secreto redis"));

        await expect(comprobarDependencias()).resolves.toEqual(["postgres", "redis"]);
    });

    it("limita una dependencia bloqueada a un timeout corto", async () => {
        dependencias.ping.mockReturnValue(new Promise(() => undefined));
        const inicio = performance.now();

        await expect(comprobarDependencias()).resolves.toEqual(["redis"]);
        expect(performance.now() - inicio).toBeLessThan(200);
    });
});
