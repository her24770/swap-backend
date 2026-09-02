import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import redis from "../../src/persistencia/redisClient";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

describe.runIf(process.env.RUN_INTEGRATION === "true")("infraestructura de integración aislada", () => {
    beforeAll(async () => {
        await limpiarEntornoIntegracion();
        await prisma.estado.createMany({
            data: [
                { estado: "activo" },
                { estado: "inactivo" },
            ],
        });
    });

    afterAll(async () => {
        await limpiarEntornoIntegracion();
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
        await redis.set("integration:health", "ok");
        expect(await redis.get("integration:health")).toBe("ok");
    });
});

