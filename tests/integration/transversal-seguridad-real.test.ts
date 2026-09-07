import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import {
    asegurarEstadosIniciales,
    asegurarTiposPerfilBase,
    crearPublicacionTest,
    crearUsuarioTest,
    type NombreEstadoComun,
} from "../helpers";
import redis from "../../src/persistencia/redisClient";
import { ServicioBcrypt } from "../../src/autenticacion/ServicioBcrypt";
import { reiniciarRateLimiters } from "../../src/autenticacion/rateLimiter";
import { registrarEventosConexion } from "../../src/sockets/socketServer";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

vi.mock("bcrypt", async () => {
    const real = await vi.importActual<typeof import("bcrypt")>("bcrypt");
    return { default: real, ...real };
});

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "TEST-08 real — transversal (seguridad y consistencia de datos)",
    () => {
        let estados: Record<NombreEstadoComun, number>;

        beforeEach(async () => {
            process.env.OPENAI_API_KEY = "mock-openai-integration-key";

            // Limpieza completa del entorno y garantía de aislamiento de datos
            await limpiarEntornoIntegracion();
            estados = await asegurarEstadosIniciales([
                "activo",
                "inactivo",
                "pendiente",
                "resuelto",
                "rechazado",
                "enviado",
                "disponible",
            ]);

            // Asegurar tipos de perfil base para publicaciones
            await asegurarTiposPerfilBase();
        });

        afterEach(async () => {
            vi.restoreAllMocks();
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("IT-34 (Escenario A): rechaza IDOR al intentar editar, cambiar estado o eliminar publicaciones y anuncios ajenos, y permite operaciones al propietario legítimo", async () => {
            // Mock de moderación externa de texto e imagen para aislar llamadas remotas
            vi.spyOn(globalThis, "fetch").mockResolvedValue({
                ok: true,
                json: async () => ({
                    results: [{ flagged: false, category_scores: {} }],
                }),
            } as any);

            // 1. Usuario A crea o posee una publicación válida
            const usuarioA = await crearUsuarioTest({ nombre: "Usuario Propietario A" });
            const publicacionA = await crearPublicacionTest({
                id_usuario: usuarioA.id_usuario,
                titulo: "Publicación Original de Usuario A",
                descripcion: "Descripción protegida y legítima del propietario A",
                precio: "150.00",
                estado: estados.activo,
                tipo_perfil: "material",
            });

            // 2. Comprobar que la publicación pertenece realmente a A
            const publicacionEnDbInicial = await prisma.publicacion.findUnique({
                where: { id_publicacion: publicacionA.id_publicacion },
            });
            expect(publicacionEnDbInicial?.id_usuario).toBe(usuarioA.id_usuario);
            expect(publicacionEnDbInicial?.titulo).toBe("Publicación Original de Usuario A");

            // 3. Usuario B autenticado (sin ownership sobre la publicación)
            const usuarioB = await crearUsuarioTest({ nombre: "Usuario Atacante B" });

            // 4. B intenta editar información protegida de la publicación de A (PATCH /api/v1/publicacion/:id)
            const respuestaEditarB = await request(app)
                .patch(`/api/v1/publicacion/${publicacionA.id_publicacion}`)
                .set("Authorization", `Bearer ${usuarioB.token}`)
                .field("titulo", "Título Modificado Maliciosamente por B")
                .field("descripcion", "Descripción modificada por un usuario ajeno")
                .field("precio", "10.00");

            expect(respuestaEditarB.status).toBe(403);
            expect(respuestaEditarB.body.success).toBe(false);

            // Verificación en BD: datos intactos
            const publicacionDespuesDeEditar = await prisma.publicacion.findUnique({
                where: { id_publicacion: publicacionA.id_publicacion },
            });
            expect(publicacionDespuesDeEditar?.titulo).toBe("Publicación Original de Usuario A");
            expect(publicacionDespuesDeEditar?.descripcion).toBe("Descripción protegida y legítima del propietario A");
            expect(Number(publicacionDespuesDeEditar?.precio)).toBe(150.00);

            // 5. B intenta cambiar el estado de la publicación de A (PATCH /api/v1/publicacion/:id/estado)
            const respuestaEstadoB = await request(app)
                .patch(`/api/v1/publicacion/${publicacionA.id_publicacion}/estado`)
                .set("Authorization", `Bearer ${usuarioB.token}`)
                .send({ estado_id: estados.inactivo });

            expect(respuestaEstadoB.status).toBe(403);
            expect(respuestaEstadoB.body.success).toBe(false);

            // Verificación en BD: estado sigue siendo 'activo'
            const publicacionDespuesDeEstado = await prisma.publicacion.findUnique({
                where: { id_publicacion: publicacionA.id_publicacion },
            });
            expect(publicacionDespuesDeEstado?.estado).toBe(estados.activo);

            // 6. B intenta eliminar la publicación de A (DELETE /api/v1/publicacion/:id)
            const respuestaEliminarB = await request(app)
                .delete(`/api/v1/publicacion/${publicacionA.id_publicacion}`)
                .set("Authorization", `Bearer ${usuarioB.token}`);

            expect(respuestaEliminarB.status).toBe(403);
            expect(respuestaEliminarB.body.success).toBe(false);

            // Verificación en BD: publicación sigue existiendo y pertenece a A
            const publicacionDespuesDeEliminar = await prisma.publicacion.findUnique({
                where: { id_publicacion: publicacionA.id_publicacion },
            });
            expect(publicacionDespuesDeEliminar).not.toBeNull();
            expect(publicacionDespuesDeEliminar?.id_usuario).toBe(usuarioA.id_usuario);

            // Verificación complementaria sobre la entidad Anuncio (relacionada con BG-02)
            const anuncioA = await prisma.anuncio.create({
                data: {
                    titulo: "Anuncio de Usuario A",
                    descripcion: "Promoción de clases particulares",
                    id_usuario: usuarioA.id_usuario,
                },
            });

            // B intenta editar el anuncio de A (PATCH /api/v1/anuncio/:id_anuncio)
            const respuestaEditarAnuncioB = await request(app)
                .patch(`/api/v1/anuncio/${anuncioA.id_anuncio}`)
                .set("Authorization", `Bearer ${usuarioB.token}`)
                .field("titulo", "Anuncio Hackeado");

            expect(respuestaEditarAnuncioB.status).toBe(403);

            // B intenta eliminar el anuncio de A (DELETE /api/v1/anuncio/:id_anuncio)
            const respuestaEliminarAnuncioB = await request(app)
                .delete(`/api/v1/anuncio/${anuncioA.id_anuncio}`)
                .set("Authorization", `Bearer ${usuarioB.token}`);

            expect(respuestaEliminarAnuncioB.status).toBe(403);

            // 7. Control positivo: Usuario A (propietario legítimo) puede editar, cambiar estado y eliminar su publicación
            const respuestaEditarA = await request(app)
                .patch(`/api/v1/publicacion/${publicacionA.id_publicacion}`)
                .set("Authorization", `Bearer ${usuarioA.token}`)
                .field("titulo", "Título Legítimamente Actualizado por A")
                .field("descripcion", "Nueva descripción actualizada por el propietario")
                .field("precio", "160.00");

            expect(respuestaEditarA.status).toBe(200);
            expect(respuestaEditarA.body.success).toBe(true);

            const publicacionActualizadaA = await prisma.publicacion.findUnique({
                where: { id_publicacion: publicacionA.id_publicacion },
            });
            expect(publicacionActualizadaA?.titulo).toBe("Título Legítimamente Actualizado por A");
            expect(Number(publicacionActualizadaA?.precio)).toBe(160.00);

            // Propietario A cambia estado a inactivo
            const respuestaEstadoA = await request(app)
                .patch(`/api/v1/publicacion/${publicacionA.id_publicacion}/estado`)
                .set("Authorization", `Bearer ${usuarioA.token}`)
                .send({ estado_id: estados.inactivo });

            expect(respuestaEstadoA.status).toBe(200);
            expect(respuestaEstadoA.body.success).toBe(true);

            // Propietario A elimina su propia publicación
            const respuestaEliminarA = await request(app)
                .delete(`/api/v1/publicacion/${publicacionA.id_publicacion}`)
                .set("Authorization", `Bearer ${usuarioA.token}`);

            expect(respuestaEliminarA.status).toBe(200);
            expect(respuestaEliminarA.body.success).toBe(true);

            const publicacionEliminadaFinal = await prisma.publicacion.findUnique({
                where: { id_publicacion: publicacionA.id_publicacion },
            });
            expect(publicacionEliminadaFinal).toBeNull();
        });

        it("IT-34 (Escenario B): garantiza privacidad de acuerdos impidiendo acceso o manipulación a usuarios ajenos (IDOR) y permitiendo consulta a participantes", async () => {
            // 1. Crear participantes legítimos: Usuario A (vendedor) y Usuario B (comprador/ofertante)
            const usuarioA = await crearUsuarioTest({ nombre: "Vendedor Usuario A" });
            const usuarioB = await crearUsuarioTest({ nombre: "Comprador Usuario B" });

            // Publicación y conversación entre A y B
            const publicacion = await crearPublicacionTest({
                id_usuario: usuarioA.id_usuario,
                titulo: "Libro de Cálculo para Acuerdo",
                descripcion: "Encuentro en campus central",
                precio: "50.00",
                estado: estados.activo,
            });

            const conversacion = await prisma.conversacion.create({
                data: {
                    id_usuario_1: usuarioA.id_usuario,
                    id_usuario_2: usuarioB.id_usuario,
                    estado_conversacion: estados.activo,
                },
            });

            // Crear un acuerdo real pendiente entre A y B
            const fechaEntregaFutura = new Date(Date.now() + 86400000);
            const acuerdoAB = await prisma.acuerdo.create({
                data: {
                    id_publicacion: publicacion.id_publicacion,
                    id_usuario: usuarioB.id_usuario, // beneficiario
                    id_ofertante: usuarioB.id_usuario, // ofertante
                    id_conversacion: conversacion.id_conversacion,
                    fecha_entrega: fechaEntregaFutura,
                    lugar_entrega: "Biblioteca Central UVG",
                    observaciones: "Entrega de libro y pago en efectivo",
                    estado: estados.pendiente,
                },
            });

            // 2. Crear Usuario C autenticado (completamente ajeno al acuerdo y a la conversación)
            const usuarioC = await crearUsuarioTest({ nombre: "Tercero Ajeno Usuario C" });

            // 3. Usuario C intenta consultar los acuerdos asociados a la conversación de A y B (GET /api/v1/acuerdo/conversacion/:id)
            const respuestaConsultaConversacionC = await request(app)
                .get(`/api/v1/acuerdo/conversacion/${conversacion.id_conversacion}`)
                .set("Authorization", `Bearer ${usuarioC.token}`);

            expect(respuestaConsultaConversacionC.status).toBe(403);
            expect(respuestaConsultaConversacionC.body.success).toBe(false);
            expect(respuestaConsultaConversacionC.body.message).toContain("No tienes permiso");

            // 4. Usuario C intenta consultar sus propios acuerdos (GET /api/v1/acuerdo)
            // Esto comprueba la regresión de BG-03: el endpoint canónico extrae el usuario del token y no filtra ni expone los acuerdos de A y B a C
            const respuestaConsultaMisAcuerdosC = await request(app)
                .get("/api/v1/acuerdo")
                .set("Authorization", `Bearer ${usuarioC.token}`);

            expect(respuestaConsultaMisAcuerdosC.status).toBe(200);
            expect(respuestaConsultaMisAcuerdosC.body.success).toBe(true);
            const acuerdosC = respuestaConsultaMisAcuerdosC.body.data;
            expect(Array.isArray(acuerdosC)).toBe(true);
            expect(acuerdosC.length).toBe(0);

            // 5. Usuario C intenta modificar el estado del acuerdo de A y B (PATCH /api/v1/acuerdo/:id/estado)
            const respuestaEstadoAcuerdoC = await request(app)
                .patch(`/api/v1/acuerdo/${acuerdoAB.id_acuerdo}/estado`)
                .set("Authorization", `Bearer ${usuarioC.token}`)
                .send({ estado: "activo" });

            expect(respuestaEstadoAcuerdoC.status).toBe(403);
            expect(respuestaEstadoAcuerdoC.body.success).toBe(false);

            // 6. Usuario C intenta editar los detalles del acuerdo de A y B (PUT /api/v1/acuerdo/:id/detalle)
            const respuestaEditarAcuerdoC = await request(app)
                .put(`/api/v1/acuerdo/${acuerdoAB.id_acuerdo}/detalle`)
                .set("Authorization", `Bearer ${usuarioC.token}`)
                .send({
                    fecha_entrega: new Date(Date.now() + 172800000),
                    lugar_entrega: "Lugar Modificado por Tercero",
                    observaciones: "Observación no autorizada",
                });

            expect(respuestaEditarAcuerdoC.status).toBe(403);
            expect(respuestaEditarAcuerdoC.body.success).toBe(false);

            // Verificación en BD: el acuerdo permanece inalterado
            const acuerdoEnDbInalterado = await prisma.acuerdo.findUnique({
                where: { id_acuerdo: acuerdoAB.id_acuerdo },
            });
            expect(acuerdoEnDbInalterado?.lugar_entrega).toBe("Biblioteca Central UVG");
            expect(acuerdoEnDbInalterado?.estado).toBe(estados.pendiente);

            // 7. Control positivo: Usuario B (participante / beneficiario) consulta legítimamente sus acuerdos
            const respuestaConsultaAcuerdosB = await request(app)
                .get("/api/v1/acuerdo")
                .set("Authorization", `Bearer ${usuarioB.token}`);

            expect(respuestaConsultaAcuerdosB.status).toBe(200);
            expect(respuestaConsultaAcuerdosB.body.success).toBe(true);
            const acuerdosB = respuestaConsultaAcuerdosB.body.data;
            expect(acuerdosB.length).toBe(1);
            expect(acuerdosB[0].id_acuerdo).toBe(acuerdoAB.id_acuerdo);
            expect(acuerdosB[0].lugar_entrega).toBe("Biblioteca Central UVG");

            // Control positivo: Usuario A (participante / vendedor) consulta los acuerdos de la conversación
            const respuestaConsultaConversacionA = await request(app)
                .get(`/api/v1/acuerdo/conversacion/${conversacion.id_conversacion}`)
                .set("Authorization", `Bearer ${usuarioA.token}`);

            expect(respuestaConsultaConversacionA.status).toBe(200);
            expect(respuestaConsultaConversacionA.body.success).toBe(true);
            const acuerdosConversacionA = respuestaConsultaConversacionA.body.data;
            expect(acuerdosConversacionA.length).toBe(1);
            expect(acuerdosConversacionA[0].id_acuerdo).toBe(acuerdoAB.id_acuerdo);
        });

        it("IT-35 (Escenario A - Auth / Redis): bloquea con 429 tras exceder intentos fallidos de login persistidos en Redis y restaura tras credenciales correctas", async () => {
            const passwordValido = "PasswordValido123!";
            const hash = await ServicioBcrypt.hashearPassword(passwordValido);
            const usuario = await crearUsuarioTest({
                nombre: "Usuario Rate Limit Auth",
                email_institucional: "ratelimit-auth@uvg.edu.gt",
                password: hash,
            });

            // 1. Ejecutar 5 intentos fallidos (límite máximo permitido para bucket login)
            for (let intento = 1; intento <= 5; intento++) {
                const respuestaFallo = await request(app)
                    .post("/api/auth/login")
                    .send({
                        email_institucional: usuario.email_institucional,
                        password: "PasswordErroneo!",
                    });

                expect(respuestaFallo.status).toBe(401);
                expect(respuestaFallo.body.success).toBe(false);
                expect(respuestaFallo.body.message).toBe("Credenciales invalidas");
            }

            // 2. Comprobar que los intentos se registraron en Redis
            const clavesRateLimit = await redis.keys("rate:login:*");
            expect(clavesRateLimit.length).toBeGreaterThanOrEqual(1);

            // 3. Intento número 6 (excede el límite): bloqueado con 429 Too Many Requests
            const respuestaBloqueada = await request(app)
                .post("/api/auth/login")
                .send({
                    email_institucional: usuario.email_institucional,
                    password: passwordValido, // Aunque la contraseña sea correcta, está bloqueado
                });

            expect(respuestaBloqueada.status).toBe(429);
            expect(respuestaBloqueada.body.success).toBe(false);
            expect(respuestaBloqueada.body.message).toContain("Demasiados intentos fallidos");

            // 4. Limpieza del limitador y login exitoso posterior
            await limpiarEntornoIntegracion();
            await asegurarEstadosIniciales(["activo"]);

            // Re-crear usuario tras limpiar entorno
            const hash2 = await ServicioBcrypt.hashearPassword(passwordValido);
            const usuarioRestaurado = await crearUsuarioTest({
                nombre: "Usuario Rate Limit Auth 2",
                email_institucional: "ratelimit-auth-2@uvg.edu.gt",
                password: hash2,
            });

            const respuestaExitosa = await request(app)
                .post("/api/auth/login")
                .send({
                    email_institucional: usuarioRestaurado.email_institucional,
                    password: passwordValido,
                });

            expect(respuestaExitosa.status).toBe(200);
            expect(respuestaExitosa.body.success).toBe(true);
            expect(respuestaExitosa.headers["set-cookie"]).toBeDefined();
        });

        it("IT-35 (Escenario B - API Global / Express): limita solicitudes masivas con 429 por IP, previene efectos secundarios y se restaura al reiniciar limitadores", async () => {
            reiniciarRateLimiters();

            const usuario = await crearUsuarioTest({ nombre: "Usuario API Global" });
            await prisma.etiqueta.create({
                data: {
                    nombre: "Etiqueta Prueba Rate Limit",
                    descripcion: "Descripción para prueba de rate limit",
                },
            });

            // 1. Ejecutar 120 peticiones permitidas dentro de la cuota global por IP
            for (let i = 1; i <= 120; i++) {
                const respuestaPermitida = await request(app)
                    .get("/api/v1/etiqueta")
                    .set("Authorization", `Bearer ${usuario.token}`);
                expect(respuestaPermitida.status).toBe(200);
                expect(respuestaPermitida.body.success).toBe(true);
            }

            // 2. Petición número 121 (supera LIMITE_API_GLOBAL = 120 req/min)
            const respuestaExcedida = await request(app)
                .get("/api/v1/etiqueta")
                .set("Authorization", `Bearer ${usuario.token}`);
            expect(respuestaExcedida.status).toBe(429);
            expect(respuestaExcedida.body.success).toBe(false);
            expect(respuestaExcedida.body.message).toBe("Demasiadas solicitudes. Intenta nuevamente más tarde.");

            // 3. Comprobar que una mutación rechazada por rate limit no produce efectos secundarios
            const conteoEtiquetasInicial = await prisma.etiqueta.count();
            const respuestaMutacionBloqueada = await request(app)
                .post("/api/v1/etiqueta")
                .set("Authorization", `Bearer ${usuario.token}`)
                .send({ nombre_etiqueta: "Etiqueta No Debe Crearse" });

            expect(respuestaMutacionBloqueada.status).toBe(429);
            const conteoEtiquetasFinal = await prisma.etiqueta.count();
            expect(conteoEtiquetasFinal).toBe(conteoEtiquetasInicial);

            // 4. Reiniciar rate limiters permite reanudar peticiones inmediatamente sin esperar la ventana de 60s
            reiniciarRateLimiters();
            const respuestaPostReinicio = await request(app)
                .get("/api/v1/etiqueta")
                .set("Authorization", `Bearer ${usuario.token}`);
            expect(respuestaPostReinicio.status).toBe(200);
            expect(respuestaPostReinicio.body.success).toBe(true);
        });

        it("IT-35 (Escenario C - Socket.IO): limita eventos masivos por usuario, no persiste mensajes bloqueados y conserva capacidad independiente para otros usuarios", async () => {
            reiniciarRateLimiters();

            // 1. Crear fixtures: 2 usuarios participantes y conversación activa
            const usuario1 = await crearUsuarioTest({ nombre: "Emisor Socket 1" });
            const usuario2 = await crearUsuarioTest({ nombre: "Emisor Socket 2" });

            const conversacion = await prisma.conversacion.create({
                data: {
                    id_usuario_1: usuario1.id_usuario,
                    id_usuario_2: usuario2.id_usuario,
                    estado_conversacion: estados.activo,
                },
            });

            type SocketEventHandler = (...args: any[]) => void | Promise<void>;
            const crearSocketMock = (idUsuario: number) => {
                const handlers = new Map<string, SocketEventHandler>();
                return {
                    handlers,
                    socket: {
                        data: { usuario: { sub: String(idUsuario), rol: "usuario" } },
                        join: vi.fn(),
                        on: vi.fn((evento: string, handler: SocketEventHandler) => handlers.set(evento, handler)),
                    },
                };
            };

            const mock1 = crearSocketMock(usuario1.id_usuario);
            const mock2 = crearSocketMock(usuario2.id_usuario);
            registrarEventosConexion(mock1.socket as any);
            registrarEventosConexion(mock2.socket as any);

            // 2. Usuario 1 emite 60 mensajes (límite máximo permitido: LIMITE_SOCKET_EVENTOS = 60)
            for (let i = 1; i <= 60; i++) {
                const respuesta = await new Promise<any>((resolve) => {
                    mock1.handlers.get("mensaje:enviar")!(
                        { id_conversacion: conversacion.id_conversacion, mensaje: `Mensaje número ${i}` },
                        resolve,
                    );
                });
                expect(respuesta.success).toBe(true);
                expect(respuesta.data).toBeDefined();
            }

            // 3. Usuario 1 emite el mensaje 61 (excede el límite): rechazado con mensaje de rate limiting
            const respuestaBloqueada = await new Promise<any>((resolve) => {
                mock1.handlers.get("mensaje:enviar")!(
                    { id_conversacion: conversacion.id_conversacion, mensaje: "Mensaje 61 excedente" },
                    resolve,
                );
            });
            expect(respuestaBloqueada.success).toBe(false);
            expect(respuestaBloqueada.message).toBe("Demasiados mensajes. Intenta nuevamente más tarde.");

            // 4. Verificación en BD: exactamente 60 mensajes persistidos (el 61 no generó persistencia)
            const totalMensajesEnDb = await prisma.mensaje.count({
                where: { id_conversacion: conversacion.id_conversacion },
            });
            expect(totalMensajesEnDb).toBe(60);

            // 5. Independencia: Usuario 2 no ha consumido su cuota y puede enviar mensajes normalmente
            const respuestaUsuario2 = await new Promise<any>((resolve) => {
                mock2.handlers.get("mensaje:enviar")!(
                    { id_conversacion: conversacion.id_conversacion, mensaje: "Mensaje legítimo de Usuario 2" },
                    resolve,
                );
            });
            expect(respuestaUsuario2.success).toBe(true);
            expect(respuestaUsuario2.data).toBeDefined();

            // Total mensajes en BD ahora es 61 (60 de usuario 1 + 1 de usuario 2)
            const totalFinalDb = await prisma.mensaje.count({
                where: { id_conversacion: conversacion.id_conversacion },
            });
            expect(totalFinalDb).toBe(61);
        });
    },
);
