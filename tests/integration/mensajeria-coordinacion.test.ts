import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServicioJWT } from "../../src/autenticacion/ServicioJWT";
import { registrarEventosConexion } from "../../src/sockets/socketServer";
import app from "../../src/app";

const estado = vi.hoisted(() => ({
  conversacion: null as any,
  mensajes: [] as any[],
  guardarMensaje: vi.fn(),
  crearAcuerdo: vi.fn(),
}));

// Las rutas de autenticación se registran al construir la app, aunque este
// flujo use JWT directamente. Evita cargar el binario nativo de bcrypt.
vi.mock("bcrypt", () => ({ default: { hash: vi.fn(), compare: vi.fn() }, hash: vi.fn(), compare: vi.fn() }));
vi.mock("../../src/autenticacion/blacklist", () => ({ estaRevocado: vi.fn().mockResolvedValue(false) }));
vi.mock("../../src/repository/repositorioEstado", () => ({
  obtenerEstadoPorNombre: vi.fn(async (nombre: string) => ({
    activo: { id_estado: 1, estado: "activo" },
    pendiente: { id_estado: 2, estado: "pendiente" },
    inactivo: { id_estado: 3, estado: "inactivo" },
    enviado: { id_estado: 4, estado: "enviado" },
  }[nombre] ?? null)),
}));
vi.mock("../../src/repository/repositorioMensaje", () => ({
  buscarConversacionEntreDosUsuarios: vi.fn(async () => estado.conversacion),
  guardarConversacionConMensajeInicial: vi.fn(async (data: any) => {
    estado.conversacion = {
      id_conversacion: 10,
      id_usuario_1: data.idEmisor,
      id_usuario_2: data.idReceptor,
      estado_conversacion: data.idEstadoPendiente,
      mensajes: [],
    };
    const mensaje = {
      id_mensaje: 1,
      id_conversacion: 10,
      id_emisor: data.idEmisor,
      mensaje: data.texto,
      estado_mensaje: data.idEstadoEnviado,
      fecha_enviado: new Date("2026-09-01T10:00:00.000Z"),
    };
    estado.mensajes.push(mensaje);
    estado.conversacion.mensajes = estado.mensajes;
    return {
      conversacion: {
        ...estado.conversacion,
        usuario1: { id_usuario: data.idEmisor, nombre: "Comprador" },
        usuario2: { id_usuario: data.idReceptor, nombre: "Vendedor" },
        contextos: [],
      },
      mensaje,
      notificacion: { id_notificacion: 1 },
    };
  }),
  buscarConversacionPorId: vi.fn(async () => estado.conversacion),
  buscarConversacionCompletaPorId: vi.fn(async () => estado.conversacion && ({
    ...estado.conversacion,
    usuario1: { id_usuario: estado.conversacion.id_usuario_1, nombre: "Comprador" },
    usuario2: { id_usuario: estado.conversacion.id_usuario_2, nombre: "Vendedor" },
    mensajes: [...estado.mensajes].reverse(),
    contextos: [],
  })),
  buscarMensajesPorConversacion: vi.fn(async () => estado.mensajes),
  buscarConversacionesPorUsuario: vi.fn(async () => []),
  actualizarConversacion: vi.fn(),
  guardarMensajeConNotificacion: estado.guardarMensaje.mockImplementation(async (data: any) => {
    const mensaje = {
      id_mensaje: estado.mensajes.length + 1,
      id_conversacion: data.idConversacion,
      id_emisor: data.idEmisor,
      mensaje: data.texto,
      estado_mensaje: data.idEstadoEnviado,
      fecha_enviado: new Date(`2026-09-01T10:0${estado.mensajes.length}:00.000Z`),
    };
    estado.mensajes.push(mensaje);
    estado.conversacion.mensajes = estado.mensajes;
    return {
      mensaje,
      notificacion: { id_notificacion: estado.mensajes.length },
      conversacion: { ...estado.conversacion, mensajes: [mensaje], contextos: [] },
    };
  }),
}));
vi.mock("../../src/repository/repositorioNotificacion", () => ({
  crearNotificacion: vi.fn(async () => ({ id_notificacion: 1 })),
}));
vi.mock("../../src/repository/repositorioContextoConversacion", () => ({ registrarContextoConversacion: vi.fn() }));
vi.mock("../../src/repository/repositorioPublicacion", () => ({
  buscarPublicacionPorId: vi.fn(async () => ({
    id_publicacion: 50,
    id_usuario: 2,
    estadoRel: { estado: "activo" },
  })),
}));
vi.mock("../../src/repository/repositorioAcuerdo", () => ({
  obtenerAcuerdosPorUsuario: vi.fn(),
  obtenerAcuerdosPorConversacion: vi.fn(async () => [{
    id_acuerdo: 8,
    id_conversacion: 10,
    estadoRel: { estado: "activo" },
    fecha_entrega: new Date("2026-09-15T10:00:00.000Z"),
    lugar_entrega: "Biblioteca",
    observaciones: "Entregar material",
  }]),
  crearAcuerdo: estado.crearAcuerdo,
  existeSolicitudDuplicada: vi.fn(),
  contarAcuerdosActivosConversacion: vi.fn(async () => 0),
  buscarAcuerdoPorId: vi.fn(),
  actualizarAcuerdo: vi.fn(),
}));
vi.mock("../../src/repository/repositorioUsuario", () => ({ buscarUsuarioPorId: vi.fn() }));
vi.mock("../../src/servicios/servicioAcuerdo", () => ({ notificarActualizacionAcuerdo: vi.fn() }));
vi.mock("../../src/sockets/ioInstance", () => ({ getIO: vi.fn(() => null), setIO: vi.fn() }));

function token(idUsuario: number) {
  return ServicioJWT.generarToken({ sub: String(idUsuario), email: `u${idUsuario}@test.com`, rol: "usuario" });
}

function prepararConversacion(estadoConversacion: number) {
  estado.conversacion = {
    id_conversacion: 10,
    id_usuario_1: 1,
    id_usuario_2: 2,
    estado_conversacion: estadoConversacion,
    mensajes: estado.mensajes,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  estado.conversacion = null;
  estado.mensajes = [];
  estado.guardarMensaje.mockClear();
  estado.crearAcuerdo.mockClear();
});

describe("TEST-04 — Mensajería y coordinación", () => {
  it("IT-19: crea el contacto y recupera el historial completo en orden", async () => {
    const creado = await request(app)
      .post("/api/conversacion")
      .set("Authorization", `Bearer ${token(1)}`)
      .send({ id_usuario_2: 2, mensaje: "¿Sigue disponible la tutoría?" })
      .expect(201);

    expect(creado.body.data.mensaje.mensaje).toBe("¿Sigue disponible la tutoría?");

    // La conversación se activa para el intercambio posterior.
    estado.conversacion.estado_conversacion = 1;
    await request(app)
      .post("/api/conversacion")
      .set("Authorization", `Bearer ${token(2)}`)
      .send({ id_usuario_2: 1, mensaje: "Sí, con gusto." })
      .expect(201);

    const historial = await request(app)
      .get("/api/conversacion/10/mensajes")
      .set("Authorization", `Bearer ${token(1)}`)
      .expect(200);

    expect(historial.body.data.map((mensaje: any) => mensaje.mensaje)).toEqual([
      "¿Sigue disponible la tutoría?",
      "Sí, con gusto.",
    ]);
  });

  it.each([
    ["pendiente", 2],
    ["bloqueada", 3],
  ])("IT-20: REST no persiste mensajes en una conversación %s", async (_nombre, idEstado) => {
    prepararConversacion(idEstado);
    if (idEstado === 2) {
      estado.mensajes.push({
        id_mensaje: 1,
        id_conversacion: 10,
        id_emisor: 1,
        mensaje: "Solicitud ya enviada",
        estado_mensaje: 4,
        fecha_enviado: new Date("2026-09-01T10:00:00.000Z"),
      });
    }

    const respuesta = await request(app)
      .post("/api/conversacion")
      .set("Authorization", `Bearer ${token(1)}`)
      .send({ id_usuario_2: 2, mensaje: "No debe guardarse" })
      .expect(idEstado === 2 ? 409 : 400);

    expect(respuesta.body.message).toMatch(idEstado === 2 ? /solicitud pendiente/i : /debe estar activa/i);
    expect(estado.guardarMensaje).not.toHaveBeenCalled();
  });

  it("SP-03: recupera el primer mensaje si una versión anterior dejó una conversación pendiente vacía", async () => {
    prepararConversacion(2);

    const respuesta = await request(app)
      .post("/api/conversacion")
      .set("Authorization", `Bearer ${token(1)}`)
      .send({ id_usuario_2: 2, mensaje: "Reintento seguro" })
      .expect(201);

    expect(respuesta.body.data.mensaje.mensaje).toBe("Reintento seguro");
    expect(estado.mensajes).toHaveLength(1);
  });

  it("SP-03: reintentar el mismo primer mensaje no crea un duplicado", async () => {
    const body = { id_usuario_2: 2, mensaje: "Mensaje idempotente" };
    await request(app)
      .post("/api/conversacion")
      .set("Authorization", `Bearer ${token(1)}`)
      .send(body)
      .expect(201);

    const repetida = await request(app)
      .post("/api/conversacion")
      .set("Authorization", `Bearer ${token(1)}`)
      .send(body)
      .expect(200);

    expect(repetida.body.data.mensaje.mensaje).toBe("Mensaje idempotente");
    expect(estado.mensajes).toHaveLength(1);
  });

  it.each([
    ["pendiente", 2],
    ["bloqueada", 3],
  ])("IT-20: Socket.IO no persiste mensajes en una conversación %s", async (_nombre, idEstado) => {
    prepararConversacion(idEstado);
    const handlers = new Map<string, Function>();
    const socket = {
      data: { usuario: { sub: "1" } },
      join: vi.fn(),
      on: vi.fn((evento: string, handler: Function) => handlers.set(evento, handler)),
    };
    registrarEventosConexion(socket as any);

    const respuesta = await new Promise<any>((resolve) => {
      handlers.get("mensaje:enviar")!({ id_conversacion: 10, mensaje: "No debe guardarse" }, resolve);
    });

    expect(respuesta).toEqual(expect.objectContaining({ success: false, message: expect.stringMatching(/debe estar activa/i) }));
    expect(estado.guardarMensaje).not.toHaveBeenCalled();
  });

  it("IT-22: rechaza crear un acuerdo si el solicitante no participa en el chat", async () => {
    prepararConversacion(1);
    await request(app)
      .post("/api/acuerdo/50")
      .set("Authorization", `Bearer ${token(99)}`)
      .send({
        id_conversacion: 10,
        fecha_entrega: "2026-09-15T10:00:00.000Z",
        lugar_entrega: "Biblioteca",
        observaciones: "Entregar material",
      })
      .expect(403);

    expect(estado.crearAcuerdo).not.toHaveBeenCalled();
  });

  it("IT-23: devuelve el acuerdo activo para que el chat muestre su recordatorio", async () => {
    prepararConversacion(1);
    const respuesta = await request(app)
      .get("/api/acuerdo/conversacion/10")
      .set("Authorization", `Bearer ${token(1)}`)
      .expect(200);

    expect(respuesta.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id_acuerdo: 8, id_conversacion: 10, estadoRel: { estado: "activo" } }),
    ]));
  });
});
