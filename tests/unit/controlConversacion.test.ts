import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  iniciarConversacion,
  obtenerMensajesDeConversacion,
  obtenerConversacionesDeUsuario,
} from "../../src/controlador/controlConversacion";

import {
  buscarConversacionEntreDosUsuarios,
  guardarConversacion,
  buscarConversacionPorId,
  buscarConversacionCompletaPorId,
  buscarMensajesPorConversacion,
  buscarConversacionesPorUsuario,
} from "../../src/repository/repositorioMensaje";
import { obtenerEstadoPorNombre } from "../../src/repository/repositorioEstado";
import { crearMensajeYNotificar } from "../../src/servicios/servicioMensajeria";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";

vi.mock("../../src/repository/repositorioMensaje", () => ({
  buscarConversacionEntreDosUsuarios: vi.fn(),
  guardarConversacion: vi.fn(),
  buscarConversacionPorId: vi.fn(),
  buscarConversacionCompletaPorId: vi.fn(),
  buscarMensajesPorConversacion: vi.fn(),
  buscarConversacionesPorUsuario: vi.fn(),
  actualizarConversacion: vi.fn(),
}));

vi.mock("../../src/repository/repositorioEstado", () => ({
  obtenerEstadoPorNombre: vi.fn(),
}));

vi.mock("../../src/servicios/servicioMensajeria", () => ({
  crearMensajeYNotificar: vi.fn(),
}));

vi.mock("../../src/servicios/Response", () => ({
  errorResponse: vi.fn(),
  exitoResponse: vi.fn(),
}));

describe("iniciarConversacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza iniciar una conversacion con uno mismo", async () => {
    const req: any = {
      usuario: { sub: "1" },
      body: { id_usuario_2: 1, mensaje: "hola" },
    };
    const res: any = {};
    const next = vi.fn();

    await iniciarConversacion(req, res, next);

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "No puedes iniciar una conversación contigo mismo",
      400
    );
    expect(guardarConversacion).not.toHaveBeenCalled();
  });

  it("crea una conversacion nueva en estado pendiente si no existe y envia el mensaje", async () => {
    vi.mocked(buscarConversacionEntreDosUsuarios).mockResolvedValue(null);
    vi.mocked(obtenerEstadoPorNombre).mockResolvedValue({
      id_estado: 3,
      estado: "pendiente",
    } as any);
    vi.mocked(guardarConversacion).mockResolvedValue({
      id_conversacion: 10,
      id_usuario_1: 1,
      id_usuario_2: 2,
      estado_conversacion: 3,
    } as any);
    vi.mocked(crearMensajeYNotificar).mockResolvedValue({
      id_mensaje: 100,
      id_conversacion: 10,
      mensaje: "hola",
    } as any);
    vi.mocked(buscarConversacionCompletaPorId).mockResolvedValue({
      id_conversacion: 10,
      id_usuario_1: 1,
      id_usuario_2: 2,
      estado_conversacion: 3,
    } as any);

    const req: any = {
      usuario: { sub: "1" },
      body: { id_usuario_2: 2, mensaje: "hola" },
    };
    const res: any = {};
    const next = vi.fn();

    await iniciarConversacion(req, res, next);

    expect(guardarConversacion).toHaveBeenCalledWith({
      usuario1: { connect: { id_usuario: 1 } },
      usuario2: { connect: { id_usuario: 2 } },
      estadoRel: { connect: { id_estado: 3 } },
    });
    expect(crearMensajeYNotificar).toHaveBeenCalledWith(10, 1, "hola");
    expect(exitoResponse).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("reutiliza la conversacion existente sin crear una nueva", async () => {
    vi.mocked(buscarConversacionEntreDosUsuarios).mockResolvedValue({
      id_conversacion: 5,
      id_usuario_1: 2,
      id_usuario_2: 1,
      estado_conversacion: 1,
    } as any);
    vi.mocked(crearMensajeYNotificar).mockResolvedValue({
      id_mensaje: 101,
    } as any);
    vi.mocked(buscarConversacionCompletaPorId).mockResolvedValue({
      id_conversacion: 5,
      id_usuario_1: 2,
      id_usuario_2: 1,
      estado_conversacion: 1,
    } as any);

    const req: any = {
      usuario: { sub: "1" },
      body: { id_usuario_2: 2, mensaje: "otra vez" },
    };
    const res: any = {};
    const next = vi.fn();

    await iniciarConversacion(req, res, next);

    expect(guardarConversacion).not.toHaveBeenCalled();
    expect(crearMensajeYNotificar).toHaveBeenCalledWith(5, 1, "otra vez");
    expect(exitoResponse).toHaveBeenCalled();
  });

  it("responde 500 si el estado 'pendiente' no esta configurado", async () => {
    vi.mocked(buscarConversacionEntreDosUsuarios).mockResolvedValue(null);
    vi.mocked(obtenerEstadoPorNombre).mockResolvedValue(null);

    const req: any = {
      usuario: { sub: "1" },
      body: { id_usuario_2: 2, mensaje: "hola" },
    };
    const res: any = {};
    const next = vi.fn();

    await iniciarConversacion(req, res, next);

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "Error de configuracion: estado 'pendiente' no encontrado",
      500
    );
    expect(guardarConversacion).not.toHaveBeenCalled();
  });
});

describe("obtenerMensajesDeConversacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responde 400 si el id de conversacion no es valido", async () => {
    const req: any = { params: { id: "abc" }, usuario: { sub: "1" } };
    const res: any = {};
    const next = vi.fn();

    await obtenerMensajesDeConversacion(req, res, next);

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "El ID de la conversacion no es valido",
      400
    );
  });

  it("responde 404 si la conversacion no existe", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue(null);

    const req: any = { params: { id: "10" }, usuario: { sub: "1" } };
    const res: any = {};
    const next = vi.fn();

    await obtenerMensajesDeConversacion(req, res, next);

    expect(errorResponse).toHaveBeenCalledWith(res, "Conversacion no encontrada", 404);
  });

  it("responde 403 si el usuario no es participante de la conversacion", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 10,
      id_usuario_1: 2,
      id_usuario_2: 3,
    } as any);

    const req: any = { params: { id: "10" }, usuario: { sub: "1" } };
    const res: any = {};
    const next = vi.fn();

    await obtenerMensajesDeConversacion(req, res, next);

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "No tienes permiso para ver esta conversacion",
      403
    );
    expect(buscarMensajesPorConversacion).not.toHaveBeenCalled();
  });

  it("devuelve los mensajes ordenados cronologicamente si el usuario es participante", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 10,
      id_usuario_1: 1,
      id_usuario_2: 2,
    } as any);
    const mensajes = [
      { id_mensaje: 1, fecha_enviado: new Date("2026-01-01") },
      { id_mensaje: 2, fecha_enviado: new Date("2026-01-02") },
    ];
    vi.mocked(buscarMensajesPorConversacion).mockResolvedValue(mensajes as any);

    const req: any = { params: { id: "10" }, usuario: { sub: "1" } };
    const res: any = {};
    const next = vi.fn();

    await obtenerMensajesDeConversacion(req, res, next);

    expect(buscarMensajesPorConversacion).toHaveBeenCalledWith(10);
    expect(exitoResponse).toHaveBeenCalledWith(
      res,
      mensajes,
      "Mensajes obtenidos exitosamente",
      200
    );
  });
});

describe("obtenerConversacionesDeUsuario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ordena las conversaciones por fecha del ultimo mensaje descendente", async () => {
    const antigua = {
      id_conversacion: 1,
      mensajes: [{ fecha_enviado: new Date("2026-01-01T10:00:00Z") }],
    };
    const reciente = {
      id_conversacion: 2,
      mensajes: [{ fecha_enviado: new Date("2026-01-05T10:00:00Z") }],
    };
    const sinMensajes = {
      id_conversacion: 3,
      mensajes: [],
    };

    vi.mocked(buscarConversacionesPorUsuario).mockResolvedValue([
      antigua,
      reciente,
      sinMensajes,
    ] as any);

    const req: any = { usuario: { sub: "1" } };
    const res: any = {};
    const next = vi.fn();

    await obtenerConversacionesDeUsuario(req, res, next);

    expect(exitoResponse).toHaveBeenCalledWith(
      res,
      [reciente, antigua, sinMensajes],
      "Conversaciones obtenidas exitosamente",
      200
    );
  });
});
