import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import redis from "../../src/persistencia/redisClient";
import { ServicioBcrypt } from "../../src/autenticacion/ServicioBcrypt";
import {
    construirClaveRecuperacionPassword,
    TIEMPO_EXPIRACION_CODIGO_SEGUNDOS,
} from "../../src/servicios/servicioCodigos";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

// login/reset-password comparan contraseñas con bcrypt real; forgot-password
// y send-register-code intentan enviar un correo (no hay credenciales de
// Resend en este entorno). Se restaura bcrypt real y se mockea solo el envío.
vi.mock("bcrypt", async () => {
    const real = await vi.importActual<typeof import("bcrypt")>("bcrypt");
    return { default: real, ...real };
});
vi.mock("../../src/servicios/servicioEmail", () => ({
    enviarCodigoRecuperacion: vi.fn(),
    enviarCodigoVerificacionRegistro: vi.fn(),
}));

const PASSWORD_PLANO = "Password1";

async function crearUsuarioConPassword(overrides: Partial<{
    email_institucional: string;
    carnet: number;
    tiempo_suspendido: number;
}> = {}) {
    const hash = await ServicioBcrypt.hashearPassword(PASSWORD_PLANO);
    return prisma.usuario.create({
        data: {
            nombre: "Usuario Sesión",
            carnet: overrides.carnet ?? 900200,
            email_institucional: overrides.email_institucional ?? "sesion@uvg.edu.gt",
            password: hash,
            url_foto_perfil: "default.png",
            tiempo_suspendido: overrides.tiempo_suspendido ?? 0,
        },
    });
}

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "TEST-01 real — sesión (login, logout, recuperación de contraseña)",
    () => {
        beforeEach(async () => {
            await limpiarEntornoIntegracion();
        });

        afterEach(async () => {
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("login: credenciales correctas devuelven 200 y una cookie de sesión", async () => {
            const usuario = await crearUsuarioConPassword();

            const respuesta = await request(app)
                .post("/api/v1/auth/login")
                .send({ email_institucional: usuario.email_institucional, password: PASSWORD_PLANO })
                .expect(200);

            expect(respuesta.headers["set-cookie"]?.[0]).toMatch(/swap-token=/);
            expect(respuesta.body.data.usuario.id_usuario).toBe(usuario.id_usuario);
        });

        it("login: contraseña incorrecta responde 401 y no entrega cookie", async () => {
            const usuario = await crearUsuarioConPassword();

            const respuesta = await request(app)
                .post("/api/v1/auth/login")
                .send({ email_institucional: usuario.email_institucional, password: "incorrecta" })
                .expect(401);

            expect(respuesta.headers["set-cookie"]).toBeUndefined();
        });

        it("login: cuenta bloqueada responde 403 aunque la contraseña sea correcta", async () => {
            const usuario = await crearUsuarioConPassword({ tiempo_suspendido: -1 });

            await request(app)
                .post("/api/v1/auth/login")
                .send({ email_institucional: usuario.email_institucional, password: PASSWORD_PLANO })
                .expect(403);
        });

        it("logout: revoca la sesión — /auth/me deja de funcionar después de cerrar sesión", async () => {
            const usuario = await crearUsuarioConPassword();
            const agente = request.agent(app);

            await agente
                .post("/api/v1/auth/login")
                .send({ email_institucional: usuario.email_institucional, password: PASSWORD_PLANO })
                .expect(200);

            await agente.get("/api/v1/auth/me").expect(200);
            await agente.post("/api/v1/auth/logout").expect(200);
            await agente.get("/api/v1/auth/me").expect(401);
        });

        it("forgot-password: responde igual exista o no la cuenta, y solo guarda código real si existe", async () => {
            const usuario = await crearUsuarioConPassword({ email_institucional: "existe@uvg.edu.gt" });

            const respuestaExistente = await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email: usuario.email_institucional })
                .expect(200);
            const respuestaInexistente = await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email: "no-existe@uvg.edu.gt" })
                .expect(200);

            expect(respuestaExistente.body.message).toBe(respuestaInexistente.body.message);

            const codigo = await redis.get(construirClaveRecuperacionPassword(usuario.email_institucional));
            expect(codigo).not.toBeNull();
            const codigoInexistente = await redis.get(construirClaveRecuperacionPassword("no-existe@uvg.edu.gt"));
            expect(codigoInexistente).toBeNull();
        });

        it("reset-password: cambia la contraseña, consume el código, y la contraseña vieja deja de servir", async () => {
            const usuario = await crearUsuarioConPassword({ email_institucional: "reset@uvg.edu.gt" });
            const codigo = "654321";
            await redis.set(construirClaveRecuperacionPassword(usuario.email_institucional), codigo, {
                EX: TIEMPO_EXPIRACION_CODIGO_SEGUNDOS,
            });

            await request(app)
                .post("/api/v1/auth/reset-password")
                .send({ email: usuario.email_institucional, code: codigo, newPassword: "NuevaPassword1" })
                .expect(200);

            await request(app)
                .post("/api/v1/auth/login")
                .send({ email_institucional: usuario.email_institucional, password: PASSWORD_PLANO })
                .expect(401);

            await request(app)
                .post("/api/v1/auth/login")
                .send({ email_institucional: usuario.email_institucional, password: "NuevaPassword1" })
                .expect(200);

            // El código ya se consumió — reutilizarlo no debe funcionar.
            await request(app)
                .post("/api/v1/auth/reset-password")
                .send({ email: usuario.email_institucional, code: codigo, newPassword: "OtraPassword1" })
                .expect(400);
        });

        it("verify-reset-code: código correcto pasa, incorrecto no", async () => {
            const usuario = await crearUsuarioConPassword({ email_institucional: "verificar@uvg.edu.gt" });
            const codigo = "111222";
            await redis.set(construirClaveRecuperacionPassword(usuario.email_institucional), codigo, {
                EX: TIEMPO_EXPIRACION_CODIGO_SEGUNDOS,
            });

            await request(app)
                .post("/api/v1/auth/verify-reset-code")
                .send({ email: usuario.email_institucional, code: "000000" })
                .expect(400);

            await request(app)
                .post("/api/v1/auth/verify-reset-code")
                .send({ email: usuario.email_institucional, code: codigo })
                .expect(200);
        });

        it("send-register-code: un correo ya registrado responde 409 y no envía código nuevo", async () => {
            const usuario = await crearUsuarioConPassword({
                email_institucional: "yaexiste@uvg.edu.gt",
                carnet: 900333,
            });

            await request(app)
                .post("/api/v1/auth/send-register-code")
                .send({ email_institucional: usuario.email_institucional, carnet: 900999 })
                .expect(409);
        });
    },
);
