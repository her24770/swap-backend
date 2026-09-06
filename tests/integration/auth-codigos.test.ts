import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";

// Este archivo prueba el registro real (POST /auth/register), que hashea la
// contraseña de verdad. tests/setup.ts mockea bcrypt globalmente para que las
// pruebas unitarias no carguen el binario nativo — aquí se restaura el
// comportamiento real, tal como indica el comentario de ese mock.
vi.mock("bcrypt", async () => {
    const real = await vi.importActual<typeof import("bcrypt")>("bcrypt");
    return { default: real, ...real };
});
import prisma from "../../src/persistencia/prismaClient";
import redis from "../../src/persistencia/redisClient";
import {
    construirClaveVerificacionRegistro,
    TIEMPO_EXPIRACION_CODIGO_SEGUNDOS,
} from "../../src/servicios/servicioCodigos";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

const EMAIL_A = "correo-a@uvg.edu.gt";
const EMAIL_B = "correo-b@uvg.edu.gt";
const CODIGO = "123456";

function datosRegistro(email: string, carnet: number, codigo: string) {
    return {
        nombre: "Usuario Prueba",
        carnet,
        email_institucional: email,
        password: "Password1",
        codigo_verificacion: codigo,
    };
}

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "TEST-01 real — Autenticación y perfiles",
    () => {
        beforeEach(async () => {
            await limpiarEntornoIntegracion();
            await redis.set(construirClaveVerificacionRegistro(EMAIL_A), CODIGO, {
                EX: TIEMPO_EXPIRACION_CODIGO_SEGUNDOS,
            });
        });

        afterEach(async () => {
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("IT-51: un código válido para un correo no sirve para registrar otro correo", async () => {
            const respuesta = await request(app)
                .post("/api/v1/auth/register")
                .send(datosRegistro(EMAIL_B, 900101, CODIGO))
                .expect(400);

            expect(respuesta.body.success).toBe(false);
            expect(respuesta.body.message).toMatch(/inválido|expirado/i);
            expect(await prisma.usuario.count()).toBe(0);
        });

        it("IT-51: control positivo — el mismo código sí registra al correo correcto", async () => {
            const respuesta = await request(app)
                .post("/api/v1/auth/register")
                .send(datosRegistro(EMAIL_A, 900102, CODIGO))
                .expect(201);

            expect(respuesta.body.success).toBe(true);
            expect(await prisma.usuario.count({ where: { email_institucional: EMAIL_A } })).toBe(1);
        });

        it("IT-51: usar el código de A contra B no consume ni invalida el código real de A", async () => {
            await request(app)
                .post("/api/v1/auth/register")
                .send(datosRegistro(EMAIL_B, 900103, CODIGO))
                .expect(400);

            // El intento fallido contra otro correo no debe borrar el código legítimo de A.
            const codigoGuardado = await redis.get(construirClaveVerificacionRegistro(EMAIL_A));
            expect(codigoGuardado).toBe(CODIGO);
        });
    },
);
