import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  cambiarEstadoUsuario,
  cambiarEstadoModerador,
  crearAdvertenciaUsuario,
} from "../../src/controlador/controlGestionCuentas";

import { buscarUsuarioPorId, actualizarUsuario } from "../../src/repository/repositorioUsuario";
import {
  buscarModeradorPorId,
  actualizarModerador,
  contarModeradoresPorTipo,
} from "../../src/repository/repositorioModerador";
import { notificarAccionModeracion } from "../../src/servicios/servicioModeracion";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";

vi.mock("../../src/repository/repositorioUsuario", () => ({
  buscarUsuarioPorId: vi.fn(),
  actualizarUsuario: vi.fn(),
}));

vi.mock("../../src/repository/repositorioModerador", () => ({
  buscarModeradorPorId: vi.fn(),
  actualizarModerador: vi.fn(),
  contarModeradoresPorTipo: vi.fn(),
}));

vi.mock("../../src/servicios/servicioModeracion", () => ({
  obtenerJustificanteModeracion: (body: unknown) => {
    if (!body || typeof body !== "object") return null;
    const { motivo, detalle } = body as { motivo?: unknown; detalle?: unknown };
    if (typeof motivo !== "string" || !motivo.trim()) return null;
    return { motivo: motivo.trim(), detalle: typeof detalle === "string" ? detalle.trim() : "" };
  },
  notificarAccionModeracion: vi.fn(),
}));

vi.mock("../../src/servicios/Response", () => ({
  errorResponse: vi.fn(),
  exitoResponse: vi.fn(),
}));

describe("cambiarEstadoUsuario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloquea un usuario y notifica, con motivo valido", async () => {
    vi.mocked(buscarUsuarioPorId).mockResolvedValue({ id_usuario: 5 } as any);

    const req: any = {
      params: { id: "5" },
      body: { accion: "bloquear", motivo: "Comportamiento abusivo reiterado" },
    };
    const res: any = {};

    await cambiarEstadoUsuario(req, res, vi.fn());

    expect(actualizarUsuario).toHaveBeenCalledWith(5, {
      tiempo_suspendido: -1,
      sesion_version: { increment: 1 },
    });
    expect(notificarAccionModeracion).toHaveBeenCalledWith(5, expect.stringContaining("bloqueada"));
    expect(exitoResponse).toHaveBeenCalled();
  });

  it("suspende un usuario calculando la fecha a partir de los dias", async () => {
    vi.mocked(buscarUsuarioPorId).mockResolvedValue({ id_usuario: 5 } as any);

    const req: any = {
      params: { id: "5" },
      body: { accion: "suspender", dias: 3, motivo: "Publicaciones falsas repetidas" },
    };
    const res: any = {};

    await cambiarEstadoUsuario(req, res, vi.fn());

    const llamada = vi.mocked(actualizarUsuario).mock.calls[0];
    expect(llamada[0]).toBe(5);
    expect(llamada[1].tiempo_suspendido as number).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(llamada[1].sesion_version).toEqual({ increment: 1 });
  });

  it("rechaza si falta el motivo", async () => {
    const req: any = { params: { id: "5" }, body: { accion: "bloquear" } };
    const res: any = {};

    await cambiarEstadoUsuario(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(res, "Debes indicar un motivo para esta accion", 400);
    expect(actualizarUsuario).not.toHaveBeenCalled();
  });

  it("rechaza una accion invalida", async () => {
    const req: any = { params: { id: "5" }, body: { accion: "eliminar", motivo: "x".repeat(10) } };
    const res: any = {};

    await cambiarEstadoUsuario(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "La accion debe ser 'bloquear', 'suspender' o 'reactivar'",
      400
    );
  });

  it("rechaza suspender sin dias", async () => {
    vi.mocked(buscarUsuarioPorId).mockResolvedValue({ id_usuario: 5 } as any);

    const req: any = {
      params: { id: "5" },
      body: { accion: "suspender", motivo: "Motivo valido de prueba" },
    };
    const res: any = {};

    await cambiarEstadoUsuario(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "Se requiere una cantidad de dias positiva para suspender una cuenta.",
      400
    );
  });

  it("responde 404 si el usuario no existe", async () => {
    vi.mocked(buscarUsuarioPorId).mockResolvedValue(null);

    const req: any = { params: { id: "99" }, body: { accion: "bloquear", motivo: "Motivo valido de prueba" } };
    const res: any = {};

    await cambiarEstadoUsuario(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(res, "Usuario no encontrado", 404);
  });
});

describe("cambiarEstadoModerador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no permite que un superadmin cambie su propio estado", async () => {
    const req: any = {
      params: { id: "1" },
      usuario: { sub: "1" },
      body: { accion: "bloquear", motivo: "Motivo valido de prueba" },
    };
    const res: any = {};

    await cambiarEstadoModerador(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(res, "No podes cambiar el estado de tu propia cuenta", 400);
    expect(buscarModeradorPorId).not.toHaveBeenCalled();
  });

  it("no permite bloquear al ultimo superadmin del sistema", async () => {
    vi.mocked(buscarModeradorPorId).mockResolvedValue({
      id_moderador: 2,
      id_tipo_moderador: 2,
      tipoRel: { tipo_moderador: "superadmin" },
    } as any);
    vi.mocked(contarModeradoresPorTipo).mockResolvedValue(1);

    const req: any = {
      params: { id: "2" },
      usuario: { sub: "1" },
      body: { accion: "bloquear", motivo: "Motivo valido de prueba" },
    };
    const res: any = {};

    await cambiarEstadoModerador(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "No podes bloquear/suspender al ultimo superadmin del sistema",
      400
    );
    expect(actualizarModerador).not.toHaveBeenCalled();
  });

  it("permite bloquear a un moderador nivel base", async () => {
    vi.mocked(buscarModeradorPorId).mockResolvedValue({
      id_moderador: 3,
      id_tipo_moderador: 1,
      tipoRel: { tipo_moderador: "moderador" },
    } as any);

    const req: any = {
      params: { id: "3" },
      usuario: { sub: "1" },
      body: { accion: "bloquear", motivo: "Motivo valido de prueba" },
    };
    const res: any = {};

    await cambiarEstadoModerador(req, res, vi.fn());

    expect(actualizarModerador).toHaveBeenCalledWith(3, {
      tiempo_suspendido: -1,
      sesion_version: { increment: 1 },
    });
    expect(exitoResponse).toHaveBeenCalled();
  });

  it("permite reactivar al ultimo superadmin (no cuenta como bloqueo)", async () => {
    vi.mocked(buscarModeradorPorId).mockResolvedValue({
      id_moderador: 2,
      id_tipo_moderador: 2,
      tipoRel: { tipo_moderador: "superadmin" },
    } as any);

    const req: any = {
      params: { id: "2" },
      usuario: { sub: "1" },
      body: { accion: "reactivar", motivo: "Motivo valido de prueba" },
    };
    const res: any = {};

    await cambiarEstadoModerador(req, res, vi.fn());

    expect(contarModeradoresPorTipo).not.toHaveBeenCalled();
    expect(actualizarModerador).toHaveBeenCalledWith(2, {
      tiempo_suspendido: 0,
      sesion_version: { increment: 1 },
    });
  });
});

describe("crearAdvertenciaUsuario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea la advertencia y notifica al usuario", async () => {
    vi.mocked(buscarUsuarioPorId).mockResolvedValue({ id_usuario: 5 } as any);

    const req: any = {
      params: { id: "5" },
      body: { motivo: "Lenguaje inapropiado en el chat", detalle: "Reportado por otro usuario" },
    };
    const res: any = {};

    await crearAdvertenciaUsuario(req, res, vi.fn());

    expect(notificarAccionModeracion).toHaveBeenCalledWith(
      5,
      expect.stringContaining("advertencia")
    );
    expect(exitoResponse).toHaveBeenCalledWith(res, { id_usuario: 5 }, "Advertencia enviada exitosamente", 200);
  });

  it("rechaza si falta el motivo", async () => {
    const req: any = { params: { id: "5" }, body: {} };
    const res: any = {};

    await crearAdvertenciaUsuario(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(res, "Debes indicar un motivo para la advertencia", 400);
    expect(notificarAccionModeracion).not.toHaveBeenCalled();
  });

  it("responde 404 si el usuario no existe", async () => {
    vi.mocked(buscarUsuarioPorId).mockResolvedValue(null);

    const req: any = { params: { id: "99" }, body: { motivo: "Motivo valido de prueba" } };
    const res: any = {};

    await crearAdvertenciaUsuario(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(res, "Usuario no encontrado", 404);
  });
});
