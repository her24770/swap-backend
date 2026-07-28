import { describe, expect, it, vi, beforeEach } from "vitest";

import { crearMensajeYNotificar } from "../../src/servicios/servicioMensajeria";
import { buscarConversacionPorId, guardarMensaje } from "../../src/repository/repositorioMensaje";
import { obtenerEstadoPorNombre } from "../../src/repository/repositorioEstado";
import { crearNotificacion } from "../../src/repository/repositorioNotificacion";
import { getIO } from "../../src/sockets/ioInstance";

vi.mock("../../src/repository/repositorioMensaje", () => ({
  buscarConversacionPorId: vi.fn(),
  guardarMensaje: vi.fn(),
}));

vi.mock("../../src/repository/repositorioEstado", () => ({
  obtenerEstadoPorNombre: vi.fn(),
}));

vi.mock("../../src/repository/repositorioNotificacion", () => ({
  crearNotificacion: vi.fn(),
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
    expect(guardarMensaje).not.toHaveBeenCalled();
  });

  it("lanza error si el estado 'enviado' no esta configurado", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1,
      id_usuario_1: 1,
      id_usuario_2: 2,
    } as any);
    vi.mocked(obtenerEstadoPorNombre).mockResolvedValue(null);

    await expect(crearMensajeYNotificar(1, 1, "hola")).rejects.toThrow(
      "Error de configuración: estado 'enviado' no encontrado"
    );
  });

  it("persiste el mensaje, notifica al receptor correcto y emite los eventos de socket", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1,
      id_usuario_1: 1,
      id_usuario_2: 2,
    } as any);
    vi.mocked(obtenerEstadoPorNombre).mockResolvedValue({ id_estado: 7, estado: "enviado" } as any);
    const mensajeGuardado = { id_mensaje: 50, id_conversacion: 1, mensaje: "hola" };
    vi.mocked(guardarMensaje).mockResolvedValue(mensajeGuardado as any);
    const notificacionCreada = { id_notificacion: 20, id_usuario: 2 };
    vi.mocked(crearNotificacion).mockResolvedValue(notificacionCreada as any);

    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    vi.mocked(getIO).mockReturnValue({ to } as any);

    const resultado = await crearMensajeYNotificar(1, 1, "hola");

    expect(guardarMensaje).toHaveBeenCalledWith({
      conversacion: { connect: { id_conversacion: 1 } },
      emisor: { connect: { id_usuario: 1 } },
      mensaje: "hola",
      estadoRel: { connect: { id_estado: 7 } },
    });
    // El receptor es el usuario_2 porque el emisor (1) es el usuario_1.
    expect(crearNotificacion).toHaveBeenCalledWith(2, "Tienes un nuevo mensaje", 7);
    expect(to).toHaveBeenCalledWith("conversacion:1");
    expect(to).toHaveBeenCalledWith("usuario:2");
    expect(emit).toHaveBeenCalledWith("mensaje:nuevo", mensajeGuardado);
    expect(emit).toHaveBeenCalledWith("notificacion:nueva", notificacionCreada);
    expect(resultado).toBe(mensajeGuardado);
  });

  it("no falla si no hay una instancia de socket.io disponible", async () => {
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 1,
      id_usuario_1: 1,
      id_usuario_2: 2,
    } as any);
    vi.mocked(obtenerEstadoPorNombre).mockResolvedValue({ id_estado: 7, estado: "enviado" } as any);
    vi.mocked(guardarMensaje).mockResolvedValue({ id_mensaje: 50 } as any);
    vi.mocked(crearNotificacion).mockResolvedValue({ id_notificacion: 20 } as any);
    vi.mocked(getIO).mockReturnValue(null);

    await expect(crearMensajeYNotificar(1, 1, "hola")).resolves.toBeTruthy();
  });
});
