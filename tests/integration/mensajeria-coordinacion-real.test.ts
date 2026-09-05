import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";
import { ServicioJWT } from "../../src/autenticacion/ServicioJWT";
import prisma from "../../src/persistencia/prismaClient";
import redis from "../../src/persistencia/redisClient";
import { registrarEventosConexion } from "../../src/sockets/socketServer";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

interface FixturesMensajeria {
    estados: Record<"activo" | "pendiente" | "inactivo" | "enviado", number>;
    compradorId: number;
    vendedorId: number;
    terceroId: number;
    publicacionId: number;
}

let fixtures: FixturesMensajeria;

function token(idUsuario: number): string {
    return ServicioJWT.generarToken({
        sub: String(idUsuario),
        email: `usuario-${idUsuario}@integration.test`,
        rol: "usuario",
    });
}

async function crearFixturesMensajeria(): Promise<FixturesMensajeria> {
    await prisma.estado.createMany({
        data: [
            { estado: "activo" },
            { estado: "pendiente" },
            { estado: "inactivo" },
            { estado: "enviado" },
        ],
    });
    const estadosGuardados = await prisma.estado.findMany();
    const estados = Object.fromEntries(
        estadosGuardados.map(({ estado, id_estado }) => [estado, id_estado]),
    ) as FixturesMensajeria["estados"];

    const [comprador, vendedor, tercero] = await Promise.all([
        prisma.usuario.create({
            data: {
                nombre: "Comprador Integración",
                carnet: 910001,
                email_institucional: "comprador@integration.test",
                password: "integration-only",
                url_foto_perfil: "comprador.png",
            },
        }),
        prisma.usuario.create({
            data: {
                nombre: "Tutora Integración",
                carnet: 910002,
                email_institucional: "tutora@integration.test",
                password: "integration-only",
                url_foto_perfil: "tutora.png",
            },
        }),
        prisma.usuario.create({
            data: {
                nombre: "Usuario Ajeno",
                carnet: 910003,
                email_institucional: "ajeno@integration.test",
                password: "integration-only",
                url_foto_perfil: "ajeno.png",
            },
        }),
    ]);
    const tipoTutoria = await prisma.tipoPerfil.create({ data: { tipo_perfil: "tutoria" } });
    const publicacion = await prisma.publicacion.create({
        data: {
            titulo: "Tutoría de cálculo",
            descripcion: "Preparación para examen",
            precio: "75.00",
            estado: estados.activo,
            tipo_publicacion: tipoTutoria.id_tipo_perfil,
            id_usuario: vendedor.id_usuario,
        },
    });

    return {
        estados,
        compradorId: comprador.id_usuario,
        vendedorId: vendedor.id_usuario,
        terceroId: tercero.id_usuario,
        publicacionId: publicacion.id_publicacion,
    };
}

async function crearConversacion(estado: number, conMensajeInicial = false) {
    return prisma.conversacion.create({
        data: {
            id_usuario_1: fixtures.compradorId,
            id_usuario_2: fixtures.vendedorId,
            estado_conversacion: estado,
            mensajes: conMensajeInicial
                ? {
                    create: {
                        id_emisor: fixtures.compradorId,
                        mensaje: "Solicitud ya enviada",
                        estado_mensaje: fixtures.estados.enviado,
                    },
                }
                : undefined,
        },
    });
}

function socketFalso(idUsuario: number) {
    const handlers = new Map<string, Function>();
    return {
        handlers,
        socket: {
            data: { usuario: { sub: String(idUsuario), rol: "usuario" } },
            join: vi.fn(),
            on: vi.fn((evento: string, handler: Function) => handlers.set(evento, handler)),
        },
    };
}

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "TEST-04 real — mensajería y coordinación con PostgreSQL/Redis",
    () => {
        beforeEach(async () => {
            await limpiarEntornoIntegracion();
            expect(await prisma.usuario.count()).toBe(0);
            expect(await redis.dbSize()).toBe(0);
            fixtures = await crearFixturesMensajeria();
        });

        afterEach(async () => {
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("IT-19: contacta a la tutora y recupera el historial completo persistido", async () => {
            const creada = await request(app)
                .post("/api/v1/conversacion")
                .set("Authorization", `Bearer ${token(fixtures.compradorId)}`)
                .send({
                    id_usuario_2: fixtures.vendedorId,
                    id_publicacion: fixtures.publicacionId,
                    mensaje: "¿Sigue disponible la tutoría?",
                })
                .expect(201);

            const idConversacion = creada.body.data.conversacion.id_conversacion;
            await request(app)
                .patch(`/api/v1/conversacion/${idConversacion}/estado`)
                .set("Authorization", `Bearer ${token(fixtures.vendedorId)}`)
                .send({ estado_id: fixtures.estados.activo })
                .expect(200);

            await request(app)
                .post("/api/v1/conversacion")
                .set("Authorization", `Bearer ${token(fixtures.vendedorId)}`)
                .send({ id_usuario_2: fixtures.compradorId, mensaje: "Sí, con gusto." })
                .expect(201);

            const historial = await request(app)
                .get(`/api/v1/conversacion/${idConversacion}/mensajes`)
                .set("Authorization", `Bearer ${token(fixtures.compradorId)}`)
                .expect(200);

            expect(historial.body.data.map((mensaje: { mensaje: string }) => mensaje.mensaje)).toEqual([
                "¿Sigue disponible la tutoría?",
                "Sí, con gusto.",
            ]);
            expect(await prisma.mensaje.count({ where: { id_conversacion: idConversacion } })).toBe(2);
            expect(await prisma.notificacion.count()).toBe(2);
            expect(await prisma.contextoConversacion.count({ where: { id_conversacion: idConversacion } })).toBe(1);
        });

        it.each([
            ["activa", "activo", 201, 1],
            ["pendiente", "pendiente", 409, 0],
            ["bloqueada", "inactivo", 400, 0],
        ] as const)(
            "IT-20: REST aplica la regla de persistencia para una conversación %s",
            async (_nombre, estado, statusEsperado, mensajesNuevos) => {
                const requiereInicial = estado !== "activo";
                const conversacion = await crearConversacion(fixtures.estados[estado], requiereInicial);
                const mensajesAntes = await prisma.mensaje.count();
                const notificacionesAntes = await prisma.notificacion.count();

                const respuesta = await request(app)
                    .post("/api/v1/conversacion")
                    .set("Authorization", `Bearer ${token(fixtures.compradorId)}`)
                    .send({ id_usuario_2: fixtures.vendedorId, mensaje: "Mensaje de verificación" })
                    .expect(statusEsperado);

                if (estado === "activo") expect(respuesta.body.success).toBe(true);
                else expect(respuesta.body.success).toBe(false);
                expect(await prisma.mensaje.count({ where: { id_conversacion: conversacion.id_conversacion } }))
                    .toBe(mensajesAntes + mensajesNuevos);
                expect(await prisma.notificacion.count()).toBe(notificacionesAntes + mensajesNuevos);
            },
        );

        it.each([
            ["activa", "activo", true, 1],
            ["pendiente", "pendiente", false, 0],
            ["bloqueada", "inactivo", false, 0],
        ] as const)(
            "IT-20: Socket.IO aplica la regla de persistencia para una conversación %s",
            async (_nombre, estado, successEsperado, mensajesNuevos) => {
                const conversacion = await crearConversacion(fixtures.estados[estado]);
                const { socket, handlers } = socketFalso(fixtures.compradorId);
                registrarEventosConexion(socket as any);

                const respuesta = await new Promise<any>((resolve) => {
                    handlers.get("mensaje:enviar")!(
                        { id_conversacion: conversacion.id_conversacion, mensaje: "Mensaje por socket" },
                        resolve,
                    );
                });

                expect(respuesta.success).toBe(successEsperado);
                expect(await prisma.mensaje.count({ where: { id_conversacion: conversacion.id_conversacion } }))
                    .toBe(mensajesNuevos);
                expect(await prisma.notificacion.count()).toBe(mensajesNuevos);
            },
        );

        it("IT-21: el contrato conserva ambos participantes al cambiar la vista del chat", async () => {
            const conversacion = await crearConversacion(fixtures.estados.activo, true);

            const vistaComprador = await request(app)
                .get("/api/v1/conversacion/conversaciones")
                .set("Authorization", `Bearer ${token(fixtures.compradorId)}`)
                .expect(200);
            const vistaVendedor = await request(app)
                .get("/api/v1/conversacion/conversaciones")
                .set("Authorization", `Bearer ${token(fixtures.vendedorId)}`)
                .expect(200);

            for (const respuesta of [vistaComprador, vistaVendedor]) {
                expect(respuesta.body.data).toEqual([
                    expect.objectContaining({
                        id_conversacion: conversacion.id_conversacion,
                        id_usuario_1: fixtures.compradorId,
                        id_usuario_2: fixtures.vendedorId,
                        usuario1: expect.objectContaining({ nombre: "Comprador Integración" }),
                        usuario2: expect.objectContaining({ nombre: "Tutora Integración" }),
                    }),
                ]);
            }
        });

        it("IT-22: impide que un usuario ajeno cree un acuerdo desde la conversación", async () => {
            const conversacion = await crearConversacion(fixtures.estados.activo);

            await request(app)
                .post(`/api/v1/acuerdo/${fixtures.publicacionId}`)
                .set("Authorization", `Bearer ${token(fixtures.terceroId)}`)
                .send({
                    id_conversacion: conversacion.id_conversacion,
                    fecha_entrega: new Date(Date.now() + 86_400_000).toISOString(),
                    lugar_entrega: "Biblioteca",
                    observaciones: "Entregar material",
                })
                .expect(403);

            expect(await prisma.acuerdo.count()).toBe(0);
        });

        it("IT-23: devuelve el acuerdo activo que alimenta el recordatorio del chat", async () => {
            const conversacion = await crearConversacion(fixtures.estados.activo);
            const acuerdo = await prisma.acuerdo.create({
                data: {
                    id_usuario: fixtures.compradorId,
                    id_ofertante: fixtures.compradorId,
                    id_publicacion: fixtures.publicacionId,
                    id_conversacion: conversacion.id_conversacion,
                    fecha_entrega: new Date(Date.now() + 86_400_000),
                    lugar_entrega: "Biblioteca",
                    observaciones: "Entregar material",
                    estado: fixtures.estados.activo,
                },
            });

            const respuesta = await request(app)
                .get(`/api/v1/acuerdo/conversacion/${conversacion.id_conversacion}`)
                .set("Authorization", `Bearer ${token(fixtures.compradorId)}`)
                .expect(200);

            expect(respuesta.body.data).toEqual([
                expect.objectContaining({
                    id_acuerdo: acuerdo.id_acuerdo,
                    id_conversacion: conversacion.id_conversacion,
                    lugar_entrega: "Biblioteca",
                    estadoRel: expect.objectContaining({ estado: "activo" }),
                    publicacion: expect.objectContaining({ titulo: "Tutoría de cálculo" }),
                }),
            ]);
        });
    },
);
