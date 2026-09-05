import { describe, expect, it, vi, beforeEach } from "vitest";

import { crearConversacionConPrimerMensaje, crearMensajeYNotificar } from "../../src/servicios/servicioMensajeria";
import {
  buscarConversacionCompletaPorId,
  buscarConversacionEntreDosUsuarios,
  buscarConversacionPorId,
  guardarConversacionConMensajeInicial,
  guardarMensajeConNotificacion,
} from "../../src/repository/repositorioMensaje";
import { obtenerEstadoPorNombre } from "../../src/repository/repositorioEstado";
import { getIO } from "../../src/sockets/ioInstance";

vi.mock("../../src/repository/repositorioMensaje", () => ({
  buscarConversacionEntreDosUsuarios: vi.fn(),
  buscarConversacionPorId: vi.fn(),
  guardarMensajeConNotificacion: vi.fn(),
  guardarConversacionConMensajeInicial: vi.fn(),
  buscarConversacionCompletaPorId: vi.fn(),
}));

vi.mock("../../src/repository/repositorioEstado", () => ({
  obtenerEstadoPorNombre: vi.fn(),
}));

vi.mock("../../src/sockets/ioInstance", () => ({
  getIO: vi.fn(),
}));

describe("crearMensajeYNotificar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza error si la conversacion no existe", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue(null);

    await expect(crearMensajeYNotificar(1, 1, "hola")).rejects.toThrow(
      "Conversación no encontrada"
    );
    expect(guardarMensajeConNotificacion).not.toHaveBeenCalled();
  });

  it("lanza error si el estado 'enviado' no esta configurado", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1,
      id_usuario_1: 1,
      id_usuario_2: 2,
      estado_conversacion: 1,
      mensajes: [],
    } as any);
    vi.mocked(obtenerEstadoPorNombre).mockImplementation(async (nombre) => ({
      activo: { id_estado: 1, estado: "activo" },
      pendiente: { id_estado: 2, estado: "pendiente" },
    }[nombre] as any ?? null));

    await expect(crearMensajeYNotificar(1, 1, "hola")).rejects.toThrow(
      "Error de configuración: estado 'enviado' no encontrado"
    );
  });

  it("persiste el mensaje, notifica al receptor correcto y emite los eventos de socket", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1,
      id_usuario_1: 1,
      id_usuario_2: 2,
      estado_conversacion: 1,
    } as any);
    vi.mocked(obtenerEstadoPorNombre).mockImplementation(async (nombre) => ({
      activo: { id_estado: 1, estado: "activo" },
      pendiente: { id_estado: 2, estado: "pendiente" },
      enviado: { id_estado: 7, estado: "enviado" },
    }[nombre] as any));
    const mensajeGuardado = { id_mensaje: 50, id_conversacion: 1, mensaje: "hola" };
    const notificacionCreada = { id_notificacion: 20, id_usuario: 2 };
    const conversacionActualizada = { id_conversacion: 1, mensajes: [mensajeGuardado] };
    vi.mocked(guardarMensajeConNotificacion).mockResolvedValue({
      mensaje: mensajeGuardado,
      notificacion: notificacionCreada,
      conversacion: conversacionActualizada,
    } as any);

    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    vi.mocked(getIO).mockReturnValue({ to } as any);

    const resultado = await crearMensajeYNotificar(1, 1, "hola");

    expect(guardarMensajeConNotificacion).toHaveBeenCalledWith({
      idConversacion: 1,
      idEmisor: 1,
      idReceptor: 2,
      texto: "hola",
      idEstadoEnviado: 7,
      idPublicacion: undefined,
    });
    expect(to).toHaveBeenCalledWith("conversacion:1");
    expect(to).toHaveBeenCalledWith("usuario:1");
    expect(to).toHaveBeenCalledWith("usuario:2");
    expect(emit).toHaveBeenCalledWith("mensaje:nuevo", mensajeGuardado);
    expect(emit).toHaveBeenCalledWith("notificacion:nueva", notificacionCreada);
    expect(emit).toHaveBeenCalledWith("conversacion:actualizada", conversacionActualizada);
    expect(resultado).toBe(mensajeGuardado);
  });

  it("no falla si no hay una instancia de socket.io disponible", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1,
      id_usuario_1: 1,
      id_usuario_2: 2,
      estado_conversacion: 1,
    } as any);
    vi.mocked(obtenerEstadoPorNombre).mockImplementation(async (nombre) => ({
      activo: { id_estado: 1 }, pendiente: { id_estado: 2 }, enviado: { id_estado: 7 },
    }[nombre] as any));
    vi.mocked(guardarMensajeConNotificacion).mockResolvedValue({
      mensaje: { id_mensaje: 50 }, notificacion: { id_notificacion: 20 }, conversacion: null,
    } as any);
    vi.mocked(getIO).mockReturnValue(null);

    await expect(crearMensajeYNotificar(1, 1, "hola")).resolves.toBeTruthy();
  });

  it("no responde con fallo si Socket.IO falla después del commit", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1, id_usuario_1: 1, id_usuario_2: 2, estado_conversacion: 1, mensajes: [],
    } as any);
    vi.mocked(obtenerEstadoPorNombre).mockImplementation(async (nombre) => ({
      activo: { id_estado: 1 }, pendiente: { id_estado: 2 }, enviado: { id_estado: 7 },
    }[nombre] as any));
    vi.mocked(guardarMensajeConNotificacion).mockResolvedValue({
      mensaje: { id_mensaje: 50 }, notificacion: { id_notificacion: 20 }, conversacion: {},
    } as any);
    vi.mocked(getIO).mockReturnValue({ to: vi.fn(() => { throw new Error("socket caído"); }) } as any);
    const consola = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(crearMensajeYNotificar(1, 1, "hola")).resolves.toMatchObject({ id_mensaje: 50 });
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });

  it("rechaza persistir mensajes en una conversación inactiva", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1, id_usuario_1: 1, id_usuario_2: 2, estado_conversacion: 3,
      mensajes: [],
    } as any);
    vi.mocked(obtenerEstadoPorNombre).mockImplementation(async (nombre) => ({
      activo: { id_estado: 1 }, pendiente: { id_estado: 2 }, enviado: { id_estado: 7 },
    }[nombre] as any));

    await expect(crearMensajeYNotificar(1, 1, "hola")).rejects.toThrow("debe estar activa");
    expect(guardarMensajeConNotificacion).not.toHaveBeenCalled();
  });

  it("rechaza a un emisor que no participa en la conversación", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1, id_usuario_1: 1, id_usuario_2: 2, estado_conversacion: 1, mensajes: [],
    } as any);

    await expect(crearMensajeYNotificar(1, 99, "hola")).rejects.toThrow("No tienes permiso");
    expect(guardarMensajeConNotificacion).not.toHaveBeenCalled();
  });

  it("recupera una conversación pendiente vacía tras un intento inicial fallido", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1, id_usuario_1: 1, id_usuario_2: 2, estado_conversacion: 2, mensajes: [],
    } as any);
    vi.mocked(obtenerEstadoPorNombre).mockImplementation(async (nombre) => ({
      activo: { id_estado: 1 }, pendiente: { id_estado: 2 }, enviado: { id_estado: 7 },
    }[nombre] as any));
    vi.mocked(guardarMensajeConNotificacion).mockResolvedValue({
      mensaje: { id_mensaje: 50 }, notificacion: { id_notificacion: 20 }, conversacion: {},
    } as any);

    await expect(crearMensajeYNotificar(1, 1, "reintento", {
      permitirMensajeInicialPendiente: true,
    })).resolves.toMatchObject({ id_mensaje: 50 });
  });

  it("no emite sockets cuando falla la transacción de persistencia", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1, id_usuario_1: 1, id_usuario_2: 2, estado_conversacion: 1, mensajes: [],
    } as any);
    vi.mocked(obtenerEstadoPorNombre).mockImplementation(async (nombre) => ({
      activo: { id_estado: 1 }, pendiente: { id_estado: 2 }, enviado: { id_estado: 7 },
    }[nombre] as any));
    vi.mocked(guardarMensajeConNotificacion).mockRejectedValue(new Error("rollback"));
    const emit = vi.fn();
    vi.mocked(getIO).mockReturnValue({ to: vi.fn(() => ({ emit })) } as any);

    await expect(crearMensajeYNotificar(1, 1, "hola")).rejects.toThrow("rollback");
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("crearConversacionConPrimerMensaje", () => {
  it("delega conversación, contexto, mensaje y notificación en una sola transacción", async () => {
    vi.mocked(obtenerEstadoPorNombre).mockImplementation(async (nombre) => ({
      pendiente: { id_estado: 2 }, enviado: { id_estado: 7 },
    }[nombre] as any));
    vi.mocked(guardarConversacionConMensajeInicial).mockResolvedValue({
      conversacion: { id_conversacion: 10 },
      mensaje: { id_mensaje: 11 },
      notificacion: { id_notificacion: 12 },
    } as any);
    vi.mocked(getIO).mockReturnValue(null);

    await crearConversacionConPrimerMensaje(1, 2, "hola", 50);

    expect(guardarConversacionConMensajeInicial).toHaveBeenCalledWith({
      idEmisor: 1,
      idReceptor: 2,
      texto: "hola",
      idEstadoPendiente: 2,
      idEstadoEnviado: 7,
      idPublicacion: 50,
    });
  });

  it("resuelve una carrera de doble creación devolviendo el primer mensaje ya confirmado", async () => {
    vi.mocked(obtenerEstadoPorNombre).mockImplementation(async (nombre) => ({
      pendiente: { id_estado: 2 }, enviado: { id_estado: 7 },
    }[nombre] as any));
    vi.mocked(guardarConversacionConMensajeInicial).mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );
    vi.mocked(buscarConversacionEntreDosUsuarios).mockResolvedValue({
      id_conversacion: 10,
      id_usuario_1: 1,
      id_usuario_2: 2,
      estado_conversacion: 2,
      mensajes: [{ id_mensaje: 11, mensaje: "hola" }],
    } as any);
    vi.mocked(buscarConversacionCompletaPorId).mockResolvedValue({ id_conversacion: 10 } as any);

    const resultado = await crearConversacionConPrimerMensaje(1, 2, "hola");
    expect(resultado.mensaje).toMatchObject({ id_mensaje: 11 });
  });
});
