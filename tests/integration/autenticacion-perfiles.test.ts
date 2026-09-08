import { setTimeout as esperar } from "node:timers/promises";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";

// Estos flujos ejercitan bcrypt real, pero sustituyen unicamente el proveedor
// externo de correo. Los codigos siguen generandose y guardandose en Redis.
vi.mock("bcrypt", async () => {
    const real = await vi.importActual<typeof import("bcrypt")>("bcrypt");
    return { default: real, ...real };
});
vi.mock("../../src/servicios/servicioEmail", () => ({
    enviarCodigoRecuperacion: vi.fn(),
    enviarCodigoVerificacionRegistro: vi.fn(),
}));

import { ServicioJWT } from "../../src/autenticacion/ServicioJWT";
import { limpiarIntentos } from "../../src/autenticacion/rateLimiter";
import prisma from "../../src/persistencia/prismaClient";
import redis from "../../src/persistencia/redisClient";
import {
    construirClaveRecuperacionPassword,
    construirClaveVerificacionRegistro,
} from "../../src/servicios/servicioCodigos";
import {
    crearModeradorTest,
    crearUsuarioAutenticableTest,
    crearUsuarioTest,
} from "../helpers/authHelpers";
import { asegurarCatalogosPerfilTest } from "../helpers/perfilHelpers";
import {
    enviarCodigoRecuperacion,
    enviarCodigoVerificacionRegistro,
} from "../../src/servicios/servicioEmail";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

function obtenerTokenDeCookie(respuesta: request.Response): string {
    const cookies = respuesta.headers["set-cookie"] as unknown as string[] | undefined;
    const cookieSesion = cookies?.find((cookie) => cookie.startsWith("swap-token="));
    const token = cookieSesion?.match(/^swap-token=([^;]+)/)?.[1];
    if (!token) throw new Error("La respuesta no incluyo la cookie swap-token");
    return decodeURIComponent(token);
}

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "TEST-01 - Autenticacion y perfiles",
    () => {
        beforeEach(async () => {
            await limpiarEntornoIntegracion();
        });

        afterEach(async () => {
            vi.restoreAllMocks();
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("IT-01: registro UVG, verificacion, login y almacenamiento del JWT en cookie HttpOnly", async () => {
            const email = "flujo.registro@uvg.edu.gt";
            const carnet = 26001001;
            const password = "Password1";

            await request(app)
                .post("/api/v1/auth/send-register-code")
                .send({ email_institucional: email, carnet })
                .expect(200);

            expect(enviarCodigoVerificacionRegistro).toHaveBeenCalledOnce();
            const codigo = vi.mocked(enviarCodigoVerificacionRegistro).mock.calls[0]?.[1];
            expect(codigo).toMatch(/^\d{6}$/);
            expect(await redis.get(construirClaveVerificacionRegistro(email))).toBe(codigo);

            const registro = await request(app)
                .post("/api/v1/auth/register")
                .send({
                    nombre: "Ana Prueba",
                    carnet,
                    email_institucional: email,
                    password,
                    codigo_verificacion: codigo,
                })
                .expect(201);

            expect(registro.body.data.usuario.email_institucional).toBe(email);
            expect(registro.headers["set-cookie"]?.[0]).toMatch(/HttpOnly/i);
            expect(await redis.get(construirClaveVerificacionRegistro(email))).toBeNull();

            const login = await request(app)
                .post("/api/v1/auth/login")
                .send({ email_institucional: email, password })
                .expect(200);
            const token = obtenerTokenDeCookie(login);
            const payload = ServicioJWT.verificarToken(token);

            expect(payload).toMatchObject({
                sub: String(registro.body.data.usuario.id_usuario),
                email,
                rol: "usuario",
                ver: 1,
            });
            expect(login.headers["set-cookie"]?.[0]).toMatch(/swap-token=.*HttpOnly/i);

            await request(app)
                .get("/api/v1/auth/me")
                .set("Cookie", `swap-token=${token}`)
                .expect(200);
        });

        it("IT-02: recuperacion controla expiracion, reintentos y cambio exitoso de password", async () => {
            const usuario = await crearUsuarioAutenticableTest({
                email_institucional: "recuperacion@uvg.edu.gt",
                passwordPlano: "Password1",
            });
            const claveCodigo = construirClaveRecuperacionPassword(usuario.email_institucional);

            await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email: usuario.email_institucional })
                .expect(200);
            expect(enviarCodigoRecuperacion).toHaveBeenCalledOnce();

            const primerCodigo = await redis.get(claveCodigo);
            expect(primerCodigo).toMatch(/^\d{6}$/);
            await redis.set(claveCodigo, primerCodigo!, { EX: 1 });
            await esperar(1_100);

            await request(app)
                .post("/api/v1/auth/verify-reset-code")
                .send({ email: usuario.email_institucional, code: primerCodigo })
                .expect(400);

            await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email: usuario.email_institucional })
                .expect(200);

            for (let intento = 0; intento < 4; intento += 1) {
                await request(app)
                    .post("/api/v1/auth/verify-reset-code")
                    .send({ email: usuario.email_institucional, code: "000000" })
                    .expect(400);
            }
            await request(app)
                .post("/api/v1/auth/verify-reset-code")
                .send({ email: usuario.email_institucional, code: "000000" })
                .expect(429);

            // Simula que termino la ventana de reintentos sin esperar diez minutos.
            await limpiarIntentos("verificar_codigo_recuperacion", usuario.email_institucional);
            await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email: usuario.email_institucional })
                .expect(200);
            const codigoVigente = await redis.get(claveCodigo);

            await request(app)
                .post("/api/v1/auth/reset-password")
                .send({
                    email: usuario.email_institucional,
                    code: codigoVigente,
                    newPassword: "NuevaPassword1",
                })
                .expect(200);

            expect(await redis.get(claveCodigo)).toBeNull();
            await request(app)
                .post("/api/v1/auth/login")
                .send({ email_institucional: usuario.email_institucional, password: usuario.passwordPlano })
                .expect(401);
            await request(app)
                .post("/api/v1/auth/login")
                .send({ email_institucional: usuario.email_institucional, password: "NuevaPassword1" })
                .expect(200);
        });

        it("IT-04 consumidor: persiste nombre y descripcion del perfil general", async () => {
            const usuario = await crearUsuarioTest();

            await request(app)
                .patch(`/api/v1/user/${usuario.id_usuario}`)
                .set("Authorization", `Bearer ${usuario.token}`)
                .send({ nombre: "Consumidor Editado" })
                .expect(200);
            await request(app)
                .patch(`/api/v1/user/${usuario.id_usuario}`)
                .set("Authorization", `Bearer ${usuario.token}`)
                .send({ descripcion: null })
                .expect(200);

            const persistido = await prisma.usuario.findUniqueOrThrow({
                where: { id_usuario: usuario.id_usuario },
            });
            expect(persistido).toMatchObject({ nombre: "Consumidor Editado", descripcion: null });
        });

        it("IT-04 vendedor: reemplaza y publica sus datos de contacto", async () => {
            const usuario = await crearUsuarioTest();
            const catalogos = await asegurarCatalogosPerfilTest();

            await request(app)
                .put(`/api/v1/user/${usuario.id_usuario}/contactos`)
                .set("Authorization", `Bearer ${usuario.token}`)
                .send({
                    contactos: [{ tipo_contacto: catalogos.tipoContacto, valor: "+502 5555-0101" }],
                })
                .expect(200);

            const perfil = await request(app)
                .get(`/api/v1/user/${usuario.id_usuario}/perfil-publico`)
                .set("Authorization", `Bearer ${usuario.token}`)
                .expect(200);
            expect(perfil.body.data.contactos).toEqual([
                expect.objectContaining({
                    tipo_contacto: catalogos.tipoContacto,
                    valor: "+502 5555-0101",
                }),
            ]);
        });

        it("BG-17: el perfil y sus contactos no se exponen sin autenticacion", async () => {
            const usuario = await crearUsuarioTest();
            const catalogos = await asegurarCatalogosPerfilTest();
            await prisma.contacto.create({
                data: {
                    id_usuario: usuario.id_usuario,
                    tipo_contacto: catalogos.tipoContacto,
                    valor: "+502 5555-0199",
                },
            });

            await request(app)
                .get(`/api/v1/user/${usuario.id_usuario}/perfil-publico`)
                .expect(401);

            const perfil = await request(app)
                .get(`/api/v1/user/${usuario.id_usuario}/perfil-publico`)
                .set("Authorization", `Bearer ${usuario.token}`)
                .expect(200);

            expect(perfil.body.data.contactos).toHaveLength(1);
            expect(perfil.body.data).not.toHaveProperty("carnet");
            expect(perfil.body.data).not.toHaveProperty("email_institucional");
            expect(perfil.body.data).not.toHaveProperty("password");
            expect(perfil.body.data).not.toHaveProperty("reportes_recibidos");
            expect(perfil.body.data).not.toHaveProperty("tiempo_suspendido");
            expect(perfil.body.data).not.toHaveProperty("sesion_version");
        });

        it("IT-04 tutor: persiste especialidades y bloques de disponibilidad", async () => {
            const usuario = await crearUsuarioTest();
            const catalogos = await asegurarCatalogosPerfilTest();

            await request(app)
                .post(`/api/v1/etiqueta/user/${usuario.id_usuario}`)
                .set("Authorization", `Bearer ${usuario.token}`)
                .send({ ids: [catalogos.etiqueta] })
                .expect(200);
            await request(app)
                .put(`/api/v1/horarios/${usuario.id_usuario}`)
                .set("Authorization", `Bearer ${usuario.token}`)
                .send({
                    bloques: [
                        { dia: "lunes", hora_inicio: "08:00", hora_fin: "10:00" },
                        { dia: "miercoles", hora_inicio: "14:00", hora_fin: "16:00" },
                    ],
                })
                .expect(200);

            expect(await prisma.usuarioEtiqueta.findMany({
                where: { id_usuario: usuario.id_usuario },
            })).toEqual([
                expect.objectContaining({ id_etiqueta: catalogos.etiqueta }),
            ]);
            const horario = await request(app)
                .get(`/api/v1/horarios/${usuario.id_usuario}`)
                .expect(200);
            expect(horario.body.data).toEqual([
                expect.objectContaining({ dia: "lunes", hora_inicio: "08:00", hora_fin: "10:00" }),
                expect.objectContaining({ dia: "miercoles", hora_inicio: "14:00", hora_fin: "16:00" }),
            ]);
        });

        it("IT-05 bloqueo: invalida inmediatamente el JWT previo del usuario", async () => {
            const usuario = await crearUsuarioTest();
            const moderador = await crearModeradorTest();

            await request(app)
                .get("/api/v1/auth/me")
                .set("Authorization", `Bearer ${usuario.token}`)
                .expect(200);
            await request(app)
                .patch(`/api/v1/moderador/usuarios/${usuario.id_usuario}/estado`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ accion: "bloquear", motivo: "Incumplimiento de normas" })
                .expect(200);
            await request(app)
                .get("/api/v1/auth/me")
                .set("Authorization", `Bearer ${usuario.token}`)
                .expect(401);
        });

        it("IT-05 cambio de rol: invalida inmediatamente el JWT previo del moderador", async () => {
            const superadmin = await crearModeradorTest({ tipo_moderador: "superadmin" });
            const moderador = await crearModeradorTest({ tipo_moderador: "moderador" });

            await request(app)
                .get("/api/v1/moderador/me")
                .set("Authorization", `Bearer ${moderador.token}`)
                .expect(200);
            await request(app)
                .patch(`/api/v1/moderador/${moderador.id_moderador}`)
                .set("Authorization", `Bearer ${superadmin.token}`)
                .send({ nivel: "superadmin" })
                .expect(200);
            await request(app)
                .get("/api/v1/moderador/me")
                .set("Authorization", `Bearer ${moderador.token}`)
                .expect(401);
        });

        it("IT-05 eliminacion: invalida inmediatamente el JWT de una cuenta borrada", async () => {
            const superadmin = await crearModeradorTest({ tipo_moderador: "superadmin" });
            const moderador = await crearModeradorTest({ tipo_moderador: "moderador" });

            await request(app)
                .get("/api/v1/moderador/me")
                .set("Authorization", `Bearer ${moderador.token}`)
                .expect(200);
            await request(app)
                .delete(`/api/v1/moderador/${moderador.id_moderador}`)
                .set("Authorization", `Bearer ${superadmin.token}`)
                .expect(200);
            await request(app)
                .get("/api/v1/moderador/me")
                .set("Authorization", `Bearer ${moderador.token}`)
                .expect(401);
        });
    },
);
