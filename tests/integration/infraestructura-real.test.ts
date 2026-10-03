import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import redis from "../../src/persistencia/redisClient";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

describe.runIf(process.env.RUN_INTEGRATION === "true")("infraestructura de integración aislada", () => {
    beforeEach(async () => {
        await limpiarEntornoIntegracion();
        await prisma.estado.createMany({
            data: [
                { estado: "activo" },
                { estado: "inactivo" },
            ],
        });
    });

    afterEach(async () => {
        await limpiarEntornoIntegracion();
    });

    afterAll(async () => {
        await cerrarEntornoIntegracion();
    });

    it("atraviesa Express, repositorio y PostgreSQL con datos dedicados", async () => {
        const respuesta = await request(app).get("/api/estado").expect(200);
        expect(respuesta.body.data).toEqual(expect.arrayContaining([
            expect.objectContaining({ estado: "activo" }),
            expect.objectContaining({ estado: "inactivo" }),
        ]));
    });

    it("lee y escribe solamente en Redis DB 15", async () => {
        expect(new URL(process.env.REDIS_URL!).pathname).toBe("/15");
        await redis.set("integration:health", "ok");
        expect(await redis.get("integration:health")).toBe("ok");
    });
});
