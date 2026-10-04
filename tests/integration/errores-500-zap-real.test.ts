import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import { cerrarEntornoIntegracion, limpiarEntornoIntegracion } from "./entornoIntegracion";
import {
    asegurarEstadosIniciales,
    crearPublicacionTest,
    crearUsuarioTest,
    generarTokenSintetico,
} from "../helpers";

// SWAP-614: los dos 500 que aparecieron durante el escaneo de OWASP ZAP.
describe.runIf(process.env.RUN_INTEGRATION === "true")("SWAP-614 — errores 500 detectados por ZAP", () => {
    let estados: Awaited<ReturnType<typeof asegurarEstadosIniciales>>;
    let vendedor: { id_usuario: number };
    let comprador: { id_usuario: number };

    const bearer = (id: number) => `Bearer ${generarTokenSintetico({ id })}`;

    beforeEach(async () => {
        await limpiarEntornoIntegracion();
        estados = await asegurarEstadosIniciales();
        vendedor = await crearUsuarioTest();
        comprador = await crearUsuarioTest();
    });

    afterEach(async () => {
        await limpiarEntornoIntegracion();
    });

    afterAll(async () => {
        await cerrarEntornoIntegracion();
    });

    describe("POST /api/v1/conversacion", () => {
        it("responde 404 (no 500) si el destinatario no existe", async () => {
            const res = await request(app)
                .post("/api/v1/conversacion")
                .set("Authorization", bearer(comprador.id_usuario))
                .send({ id_usuario_2: 999999, mensaje: "Hola, ¿sigue disponible?" });

            expect(res.status).toBe(404);
            expect(await prisma.conversacion.count()).toBe(0);
        });

        it("sigue creando la conversación cuando el destinatario existe", async () => {
            const res = await request(app)
                .post("/api/v1/conversacion")
                .set("Authorization", bearer(comprador.id_usuario))
                .send({ id_usuario_2: vendedor.id_usuario, mensaje: "Hola, ¿sigue disponible?" });

            expect(res.status).toBe(201);
            expect(await prisma.conversacion.count()).toBe(1);
        });
    });

    describe("DELETE /api/v1/publicacion/:id", () => {
        async function borrar(idPublicacion: number) {
            return request(app)
                .delete(`/api/v1/publicacion/${idPublicacion}`)
                .set("Authorization", bearer(vendedor.id_usuario));
        }

        it("elimina una publicación sin relaciones", async () => {
            const pub = await crearPublicacionTest({ id_usuario: vendedor.id_usuario });

            expect((await borrar(pub.id_publicacion)).status).toBe(200);
            expect(await prisma.publicacion.findUnique({ where: { id_publicacion: pub.id_publicacion } })).toBeNull();
        });

        it("elimina una publicación que otro usuario guardó o le dio like (antes: 500)", async () => {
            const pub = await crearPublicacionTest({ id_usuario: vendedor.id_usuario });
            await prisma.usuarioPublicacion.create({
                data: { id_usuario: comprador.id_usuario, id_publicacion: pub.id_publicacion, is_like: true, is_save: true },
            });

            expect((await borrar(pub.id_publicacion)).status).toBe(200);
            expect(await prisma.publicacion.findUnique({ where: { id_publicacion: pub.id_publicacion } })).toBeNull();
            expect(await prisma.usuarioPublicacion.count({ where: { id_publicacion: pub.id_publicacion } })).toBe(0);
        });

        it("elimina una publicación con contexto de conversación y conserva la conversación (antes: 500)", async () => {
            const pub = await crearPublicacionTest({ id_usuario: vendedor.id_usuario });
            const conversacion = await prisma.conversacion.create({
                data: { id_usuario_1: comprador.id_usuario, id_usuario_2: vendedor.id_usuario, estado_conversacion: estados.activo },
            });
            await prisma.contextoConversacion.create({
                data: { id_conversacion: conversacion.id_conversacion, id_publicacion: pub.id_publicacion, id_usuario: comprador.id_usuario },
            });

            expect((await borrar(pub.id_publicacion)).status).toBe(200);
            expect(await prisma.conversacion.findUnique({ where: { id_conversacion: conversacion.id_conversacion } })).not.toBeNull();
        });

        it("no elimina una publicación con acuerdos: responde 409 y conserva todo (antes: 500)", async () => {
            const pub = await crearPublicacionTest({ id_usuario: vendedor.id_usuario });
            const conversacion = await prisma.conversacion.create({
                data: { id_usuario_1: comprador.id_usuario, id_usuario_2: vendedor.id_usuario, estado_conversacion: estados.activo },
            });
            await prisma.acuerdo.create({
                data: {
                    id_usuario: comprador.id_usuario,
                    id_ofertante: vendedor.id_usuario,
                    id_publicacion: pub.id_publicacion,
                    id_conversacion: conversacion.id_conversacion,
                    fecha_entrega: new Date(),
                    lugar_entrega: "Biblioteca",
                    observaciones: "",
                    estado: estados.pendiente,
                },
            });

            const res = await borrar(pub.id_publicacion);
            expect(res.status).toBe(409);
            expect(await prisma.publicacion.findUnique({ where: { id_publicacion: pub.id_publicacion } })).not.toBeNull();
            expect(await prisma.acuerdo.count()).toBe(1);
        });

        // No era uno de los 500: Reporte.id_publicacion es opcional y la BD lo deja en null.
        it("elimina una publicación reportada y conserva el reporte sin el vínculo", async () => {
            const pub = await crearPublicacionTest({ id_usuario: vendedor.id_usuario });
            const motivo = await prisma.motivoReporte.create({ data: { motivo: `Contenido inapropiado ${pub.id_publicacion}` } });
            await prisma.reporte.create({
                data: {
                    id_emisor: comprador.id_usuario,
                    id_receptor: vendedor.id_usuario,
                    id_publicacion: pub.id_publicacion,
                    motivo: motivo.id_motivo,
                    observaciones: "Publicación ofensiva",
                    estado: estados.pendiente,
                },
            });

            expect((await borrar(pub.id_publicacion)).status).toBe(200);
            const reportes = await prisma.reporte.findMany();
            expect(reportes).toHaveLength(1);
            expect(reportes[0].id_publicacion).toBeNull();
        });
    });
});
