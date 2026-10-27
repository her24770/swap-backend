import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import {
    asegurarEstadosIniciales,
    asegurarTiposPerfilBase,
    crearModeradorTest,
    crearPublicacionTest,
    crearUsuarioTest,
    type NombreEstadoComun,
} from "../helpers";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "ST-TT-S10-01-1 (SWAP-652) — Exclusión de publicaciones del usuario autenticado en listados y búsquedas",
    () => {
        let estados: Record<NombreEstadoComun, number>;

        beforeEach(async () => {
            await limpiarEntornoIntegracion();
            estados = await asegurarEstadosIniciales([
                "activo",
                "inactivo",
                "pendiente",
                "disponible",
            ]);
            await asegurarTiposPerfilBase();
        });

        afterEach(async () => {
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("un usuario con publicaciones activas no ve las suyas en listados ni filtros, y moderación ve todo", async () => {
            // 1. Crear dos usuarios y un moderador
            const usuarioA = await crearUsuarioTest({ nombre: "Usuario A Vendedor" });
            const usuarioB = await crearUsuarioTest({ nombre: "Usuario B Vendedor" });
            const moderador = await crearModeradorTest({ usuario: "mod_auditor" });

            // 2. Crear 2 publicaciones para usuarioA y 3 publicaciones para usuarioB
            const pubA1 = await crearPublicacionTest({
                id_usuario: usuarioA.id_usuario,
                titulo: "Libro Álgebra de Usuario A",
                precio: "50.00",
                tipo_perfil: "material",
                estado: estados.activo,
            });
            const pubA2 = await crearPublicacionTest({
                id_usuario: usuarioA.id_usuario,
                titulo: "Calculadora de Usuario A",
                precio: "75.00",
                tipo_perfil: "material",
                estado: estados.activo,
            });

            const pubB1 = await crearPublicacionTest({
                id_usuario: usuarioB.id_usuario,
                titulo: "Libro Física de Usuario B",
                precio: "60.00",
                tipo_perfil: "material",
                estado: estados.activo,
            });
            const pubB2 = await crearPublicacionTest({
                id_usuario: usuarioB.id_usuario,
                titulo: "Cuaderno de Usuario B",
                precio: "20.00",
                tipo_perfil: "material",
                estado: estados.activo,
            });
            const pubB3 = await crearPublicacionTest({
                id_usuario: usuarioB.id_usuario,
                titulo: "Mochila de Usuario B",
                precio: "100.00",
                tipo_perfil: "material",
                estado: estados.activo,
            });

            // 3. Usuario A consulta GET /api/v1/publicacion:
            // Debe recibir ÚNICAMENTE las 3 publicaciones de Usuario B
            const resListadoA = await request(app)
                .get("/api/v1/publicacion")
                .query({ tipo: "material", limit: 10 })
                .set("Authorization", `Bearer ${usuarioA.token}`)
                .expect(200);

            const pubsListadoA = resListadoA.body.data.publicaciones;
            expect(resListadoA.body.data.total).toBe(3);
            expect(pubsListadoA).toHaveLength(3);

            const idsListadoA = pubsListadoA.map((p: any) => p.id_publicacion);
            expect(idsListadoA).toContain(pubB1.id_publicacion);
            expect(idsListadoA).toContain(pubB2.id_publicacion);
            expect(idsListadoA).toContain(pubB3.id_publicacion);
            expect(idsListadoA).not.toContain(pubA1.id_publicacion);
            expect(idsListadoA).not.toContain(pubA2.id_publicacion);

            // 4. Usuario B consulta GET /api/v1/publicacion:
            // Debe recibir ÚNICAMENTE las 2 publicaciones de Usuario A
            const resListadoB = await request(app)
                .get("/api/v1/publicacion")
                .query({ tipo: "material", limit: 10 })
                .set("Authorization", `Bearer ${usuarioB.token}`)
                .expect(200);

            const pubsListadoB = resListadoB.body.data.publicaciones;
            expect(resListadoB.body.data.total).toBe(2);
            expect(pubsListadoB).toHaveLength(2);

            const idsListadoB = pubsListadoB.map((p: any) => p.id_publicacion);
            expect(idsListadoB).toContain(pubA1.id_publicacion);
            expect(idsListadoB).toContain(pubA2.id_publicacion);
            expect(idsListadoB).not.toContain(pubB1.id_publicacion);
            expect(idsListadoB).not.toContain(pubB2.id_publicacion);
            expect(idsListadoB).not.toContain(pubB3.id_publicacion);

            // 5. Usuario A realiza búsqueda con filtros POST /api/v1/publicacion/buscar:
            // Filtro por precio de 10 a 90 (coinciden A1: 50, A2: 75, B1: 60, B2: 20)
            const resFiltrosA = await request(app)
                .post("/api/v1/publicacion/buscar")
                .set("Authorization", `Bearer ${usuarioA.token}`)
                .send({
                    tipo: "material",
                    precio_min: 10,
                    precio_max: 90,
                    estado: "activo",
                })
                .expect(200);

            const idsFiltrosA = resFiltrosA.body.data.publicaciones.map((p: any) => p.id_publicacion);
            expect(idsFiltrosA).toContain(pubB1.id_publicacion);
            expect(idsFiltrosA).toContain(pubB2.id_publicacion);
            expect(idsFiltrosA).not.toContain(pubA1.id_publicacion);
            expect(idsFiltrosA).not.toContain(pubA2.id_publicacion);

            // 6. Moderador consulta GET /api/v1/moderador/publicaciones:
            // El panel de moderación debe ver TODAS las publicaciones activas (total = 5)
            const resModerador = await request(app)
                .get("/api/v1/moderador/publicaciones?estado=activo")
                .set("Authorization", `Bearer ${moderador.token}`)
                .expect(200);

            const idsModerador = resModerador.body.data.publicaciones.map((p: any) => p.id_publicacion);
            expect(resModerador.body.data.total).toBe(5);
            expect(idsModerador).toContain(pubA1.id_publicacion);
            expect(idsModerador).toContain(pubA2.id_publicacion);
            expect(idsModerador).toContain(pubB1.id_publicacion);
            expect(idsModerador).toContain(pubB2.id_publicacion);
            expect(idsModerador).toContain(pubB3.id_publicacion);
        });
    }
);
