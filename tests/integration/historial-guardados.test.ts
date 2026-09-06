import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import { crearUsuarioTest, UsuarioTestFixture } from "../helpers";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

interface FixturesHistorial {
    estados: Record<"activo" | "completado" | "pendiente", number>;
    comprador: UsuarioTestFixture;
    vendedor: UsuarioTestFixture;
    otro: UsuarioTestFixture;
    pubMaterialId: number;
    pubTutoriaId: number;
    pubNegocioId: number;
    conversacionCompradorId: number;
    conversacionOtroId: number;
}

let fixtures: FixturesHistorial;

async function crearFixturesHistorial(): Promise<FixturesHistorial> {
    await prisma.estado.createMany({
        data: [{ estado: "activo" }, { estado: "completado" }, { estado: "pendiente" }],
    });
    const estadosGuardados = await prisma.estado.findMany();
    const estados = Object.fromEntries(
        estadosGuardados.map(({ estado, id_estado }) => [estado, id_estado]),
    ) as FixturesHistorial["estados"];

    const [comprador, vendedor, otro] = await Promise.all([
        crearUsuarioTest({ nombre: "Comprador Historial" }),
        crearUsuarioTest({ nombre: "Vendedor Historial" }),
        crearUsuarioTest({ nombre: "Usuario Ajeno" }),
    ]);

    const [tipoMaterial, tipoTutoria, tipoNegocio] = await Promise.all([
        prisma.tipoPerfil.create({ data: { tipo_perfil: "material" } }),
        prisma.tipoPerfil.create({ data: { tipo_perfil: "tutoria" } }),
        prisma.tipoPerfil.create({ data: { tipo_perfil: "negocio" } }),
    ]);

    const [pubMaterial, pubTutoria, pubNegocio] = await Promise.all([
        prisma.publicacion.create({
            data: {
                titulo: "Libro de Cálculo 1",
                descripcion: "Usado, buen estado",
                precio: "50.00",
                estado: estados.activo,
                tipo_publicacion: tipoMaterial.id_tipo_perfil,
                id_usuario: vendedor.id_usuario,
            },
        }),
        prisma.publicacion.create({
            data: {
                titulo: "Tutoría de Física 1",
                descripcion: "Preparación de examen",
                precio: "75.00",
                estado: estados.activo,
                tipo_publicacion: tipoTutoria.id_tipo_perfil,
                id_usuario: vendedor.id_usuario,
            },
        }),
        prisma.publicacion.create({
            data: {
                titulo: "Diseño de logos",
                descripcion: "Servicio de diseño gráfico",
                precio: "100.00",
                estado: estados.activo,
                tipo_publicacion: tipoNegocio.id_tipo_perfil,
                id_usuario: vendedor.id_usuario,
            },
        }),
    ]);

    const [conversacionComprador, conversacionOtro] = await Promise.all([
        prisma.conversacion.create({
            data: {
                id_usuario_1: comprador.id_usuario,
                id_usuario_2: vendedor.id_usuario,
                estado_conversacion: estados.activo,
            },
        }),
        prisma.conversacion.create({
            data: {
                id_usuario_1: otro.id_usuario,
                id_usuario_2: vendedor.id_usuario,
                estado_conversacion: estados.activo,
            },
        }),
    ]);

    return {
        estados,
        comprador,
        vendedor,
        otro,
        pubMaterialId: pubMaterial.id_publicacion,
        pubTutoriaId: pubTutoria.id_publicacion,
        pubNegocioId: pubNegocio.id_publicacion,
        conversacionCompradorId: conversacionComprador.id_conversacion,
        conversacionOtroId: conversacionOtro.id_conversacion,
    };
}

// Varios acuerdos entre el mismo par de usuarios comparten una sola conversación
// (la restricción única del modelo es por par de usuarios, no por acuerdo).
async function crearAcuerdoCompletado(idUsuario: number, idPublicacion: number, idConversacion: number) {
    return prisma.acuerdo.create({
        data: {
            id_usuario: idUsuario,
            id_ofertante: idUsuario,
            id_publicacion: idPublicacion,
            id_conversacion: idConversacion,
            fecha_entrega: new Date(Date.now() - 86_400_000),
            lugar_entrega: "Campus central",
            observaciones: "Entrega realizada",
            estado: fixtures.estados.completado,
        },
    });
}

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "TEST-07 real — Historial y guardados",
    () => {
        beforeEach(async () => {
            await limpiarEntornoIntegracion();
            fixtures = await crearFixturesHistorial();
        });

        afterEach(async () => {
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("IT-31: historial de productos comprados incluye material y negocio, pero no tutorías", async () => {
            await crearAcuerdoCompletado(fixtures.comprador.id_usuario, fixtures.pubMaterialId, fixtures.conversacionCompradorId);
            await crearAcuerdoCompletado(fixtures.comprador.id_usuario, fixtures.pubNegocioId, fixtures.conversacionCompradorId);
            await crearAcuerdoCompletado(fixtures.comprador.id_usuario, fixtures.pubTutoriaId, fixtures.conversacionCompradorId);
            // Acuerdo de otro usuario — no debe aparecer en el historial del comprador.
            await crearAcuerdoCompletado(fixtures.otro.id_usuario, fixtures.pubMaterialId, fixtures.conversacionOtroId);

            const respuesta = await request(app)
                .get("/api/v1/acuerdo")
                .query({ tipo: "producto", estado: "completado" })
                .set("Authorization", `Bearer ${fixtures.comprador.token}`)
                .expect(200);

            const idsPublicaciones = respuesta.body.data.map((a: any) => a.id_publicacion).sort();
            expect(idsPublicaciones).toEqual([fixtures.pubMaterialId, fixtures.pubNegocioId].sort());
            expect(respuesta.body.data.every((a: any) => a.id_usuario === fixtures.comprador.id_usuario)).toBe(true);
        });

        it("IT-32: historial de tutorías tomadas solo incluye publicaciones de tipo tutoría", async () => {
            await crearAcuerdoCompletado(fixtures.comprador.id_usuario, fixtures.pubMaterialId, fixtures.conversacionCompradorId);
            await crearAcuerdoCompletado(fixtures.comprador.id_usuario, fixtures.pubTutoriaId, fixtures.conversacionCompradorId);

            const respuesta = await request(app)
                .get("/api/v1/acuerdo")
                .query({ tipo: "tutoria", estado: "completado" })
                .set("Authorization", `Bearer ${fixtures.comprador.token}`)
                .expect(200);

            expect(respuesta.body.data).toHaveLength(1);
            expect(respuesta.body.data[0].id_publicacion).toBe(fixtures.pubTutoriaId);
        });

        it("IT-33: guardados devuelve solo lo que el usuario guardó, con el tipo para agrupar en su espacio", async () => {
            await request(app)
                .post(`/api/v1/guardados/${fixtures.pubMaterialId}`)
                .set("Authorization", `Bearer ${fixtures.comprador.token}`)
                .expect(200);
            await request(app)
                .post(`/api/v1/guardados/${fixtures.pubTutoriaId}`)
                .set("Authorization", `Bearer ${fixtures.comprador.token}`)
                .expect(200);
            // El "otro" usuario guarda la publicación de negocio — no debe mezclarse en el espacio del comprador.
            await request(app)
                .post(`/api/v1/guardados/${fixtures.pubNegocioId}`)
                .set("Authorization", `Bearer ${fixtures.otro.token}`)
                .expect(200);

            const respuesta = await request(app)
                .get("/api/v1/guardados")
                .set("Authorization", `Bearer ${fixtures.comprador.token}`)
                .expect(200);

            expect(respuesta.body.data).toHaveLength(2);
            const idsGuardados = respuesta.body.data.map((g: any) => g.id_publicacion).sort();
            expect(idsGuardados).toEqual([fixtures.pubMaterialId, fixtures.pubTutoriaId].sort());
            // El tipo de cada publicación debe venir presente — es lo que el frontend usa para agrupar por "espacio".
            expect(respuesta.body.data.every((g: any) => g.publicacion.tipo_publicacion !== undefined)).toBe(true);
        });
    },
);
