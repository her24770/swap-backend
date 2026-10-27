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
        estados = await asegurarEstadosIniciales([
            "activo", "inactivo", "pendiente", "resuelto", "rechazado", "enviado", "leido" as any
        ]);
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

        // ST-TT-S10-01-4 (SWAP-652): Al eliminar una publicación reportada, se cierra el reporte con snapshot
        it("elimina una publicación reportada, cierra el reporte como resuelto y guarda snapshot histórico", async () => {
            const pub = await crearPublicacionTest({ id_usuario: vendedor.id_usuario, titulo: "Libro de Cálculo Avanzado", precio: "150.00" });
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
            expect(await prisma.publicacion.findUnique({ where: { id_publicacion: pub.id_publicacion } })).toBeNull();

            const reportes = await prisma.reporte.findMany();
            expect(reportes).toHaveLength(1);
            expect(reportes[0].id_publicacion).toBeNull();
            expect(reportes[0].estado).toBe(estados.resuelto);
            expect(reportes[0].observaciones).toContain("Denuncia original: \"Publicación ofensiva\"");
            expect(reportes[0].observaciones).toContain("[Snapshot - Publicación Eliminada]");
            expect(reportes[0].observaciones).toContain("Libro de Cálculo Avanzado");
            expect(reportes[0].observaciones).toContain("Q150.00");
            expect(reportes[0].observaciones).toContain("Resuelto por: Sistema (Cierre automático por eliminación del autor)");
        });
    });

    // ST-TT-S10-01-3 / SWAP-614: Validación de ID numérico positivo en rutas de notificación
    describe("PATCH /api/v1/notificacion/:id/estado", () => {
        it("responde 400 (no 500) con mensaje claro si el id es 'abc'", async () => {
            const res = await request(app)
                .patch("/api/v1/notificacion/abc/estado")
                .set("Authorization", bearer(vendedor.id_usuario))
                .send({ estado: "leido" });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.errores).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        campo: "id",
                        mensaje: expect.stringContaining("El ID de la notificación debe ser un número"),
                    }),
                ])
            );
        });

        it("responde 400 si el id es un número negativo, cero o decimal", async () => {
            const resNegativo = await request(app)
                .patch("/api/v1/notificacion/-1/estado")
                .set("Authorization", bearer(vendedor.id_usuario))
                .send({ estado: "leido" });
            expect(resNegativo.status).toBe(400);

            const resCero = await request(app)
                .patch("/api/v1/notificacion/0/estado")
                .set("Authorization", bearer(vendedor.id_usuario))
                .send({ estado: "leido" });
            expect(resCero.status).toBe(400);

            const resDecimal = await request(app)
                .patch("/api/v1/notificacion/1.5/estado")
                .set("Authorization", bearer(vendedor.id_usuario))
                .send({ estado: "leido" });
            expect(resDecimal.status).toBe(400);
        });

        it("responde 400 si el estado enviado en el body no es válido", async () => {
            const res = await request(app)
                .patch("/api/v1/notificacion/1/estado")
                .set("Authorization", bearer(vendedor.id_usuario))
                .send({ estado: "desconocido" });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it("responde 404 si la notificación no existe", async () => {
            const res = await request(app)
                .patch("/api/v1/notificacion/999999/estado")
                .set("Authorization", bearer(vendedor.id_usuario))
                .send({ estado: "leido" });

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it("actualiza a 'leido' cuando id y estado son válidos y pertenece al usuario", async () => {
            const notif = await prisma.notificacion.create({
                data: {
                    id_usuario: vendedor.id_usuario,
                    mensaje: "Tienes una nueva solicitud",
                    id_estado: estados.enviado,
                },
            });

            const res = await request(app)
                .patch(`/api/v1/notificacion/${notif.id_notificacion}/estado`)
                .set("Authorization", bearer(vendedor.id_usuario))
                .send({ estado: "leido" });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            const enDb = await prisma.notificacion.findUnique({
                where: { id_notificacion: notif.id_notificacion },
                include: { estado: true },
            });
            expect(enDb?.estado.estado).toBe("leido");
        });
    });
});
