import { describe, expect, it, vi, beforeEach } from "vitest";

import { iniciarSesionModerador, obtenerSesionModeradorActual } from "../../src/controlador/controlModerador";

import {
  buscarModeradorPorUsuario,
  buscarModeradorPorId,
  actualizarModerador,
} from "../../src/repository/repositorioModerador";
import {
  estaBloqueado,
  registrarIntentoFallido,
  limpiarIntentos,
} from "../../src/autenticacion/rateLimiter";
import { ServicioBcrypt } from "../../src/autenticacion/ServicioBcrypt";
import { ServicioJWT } from "../../src/autenticacion/ServicioJWT";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";

vi.mock("../../src/repository/repositorioModerador", () => ({
  buscarModeradorPorUsuario: vi.fn(),
  buscarModeradorPorId: vi.fn(),
  actualizarModerador: vi.fn(),
}));

vi.mock("../../src/autenticacion/rateLimiter", () => ({
  estaBloqueado: vi.fn(),
  registrarIntentoFallido: vi.fn(),
  limpiarIntentos: vi.fn(),
}));

vi.mock("../../src/autenticacion/ServicioBcrypt", () => ({
  ServicioBcrypt: {
    compararPassword: vi.fn(),
  },
}));

vi.mock("../../src/autenticacion/ServicioJWT", () => ({
  ServicioJWT: {
    generarToken: vi.fn(),
  },
}));

vi.mock("../../src/servicios/Response", () => ({
  errorResponse: vi.fn(),
  exitoResponse: vi.fn(),
}));

function moderadorMock(nivel: "moderador" | "superadmin", tiempoSuspendido = 0) {
  return {
    id_moderador: 1,
    usuario: nivel === "superadmin" ? "superadmin1" : "moderador1",
    password: "hash",
    id_tipo_moderador: nivel === "superadmin" ? 2 : 1,
    tipoRel: { id_tipo_moderador: nivel === "superadmin" ? 2 : 1, tipo_moderador: nivel },
    tiempo_suspendido: tiempoSuspendido,
  };
}

describe("iniciarSesionModerador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite iniciar sesion con credenciales correctas y setea el rol segun el nivel (moderador)", async () => {
    vi.mocked(estaBloqueado).mockResolvedValue(false);
    vi.mocked(buscarModeradorPorUsuario).mockResolvedValue(moderadorMock("moderador") as any);
    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(true);
    vi.mocked(ServicioJWT.generarToken).mockReturnValue("jwt-token");

    const req: any = {
      ip: "127.0.0.1",
      body: { usuario: "moderador1", password: "Moderador123!" },
    };
    const res: any = { cookie: vi.fn() };
    const next = vi.fn();

    await iniciarSesionModerador(req, res, next);

    expect(ServicioJWT.generarToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "1", rol: "moderador" })
    );
    expect(res.cookie).toHaveBeenCalledWith("swap-token", "jwt-token", expect.any(Object));
    expect(limpiarIntentos).toHaveBeenCalledWith("127.0.0.1");
    expect(exitoResponse).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("setea el rol 'superadmin' en el JWT cuando el moderador es de ese nivel", async () => {
    vi.mocked(estaBloqueado).mockResolvedValue(false);
    vi.mocked(buscarModeradorPorUsuario).mockResolvedValue(moderadorMock("superadmin") as any);
    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(true);
    vi.mocked(ServicioJWT.generarToken).mockReturnValue("jwt-token-superadmin");

    const req: any = {
      ip: "127.0.0.1",
      body: { usuario: "superadmin1", password: "SuperAdmin123!" },
    };
    const res: any = { cookie: vi.fn() };

    await iniciarSesionModerador(req, res, vi.fn());

    expect(ServicioJWT.generarToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "1", rol: "superadmin" })
    );
    expect(exitoResponse).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ rol: "superadmin" }),
      "Inicio de sesion exitoso",
      200
    );
  });

  it("rechaza si el usuario moderador no existe", async () => {
    vi.mocked(estaBloqueado).mockResolvedValue(false);
    vi.mocked(buscarModeradorPorUsuario).mockResolvedValue(null);

    const req: any = {
      ip: "127.0.0.1",
      body: { usuario: "no-existe", password: "123" },
    };
    const res: any = {};

    await iniciarSesionModerador(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(res, "Credenciales invalidas", 401);
    expect(ServicioBcrypt.compararPassword).not.toHaveBeenCalled();
  });

  it("rechaza contraseña incorrecta y registra el intento fallido", async () => {
    vi.mocked(estaBloqueado).mockResolvedValue(false);
    vi.mocked(buscarModeradorPorUsuario).mockResolvedValue(moderadorMock("moderador") as any);
    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(false);

    const req: any = {
      ip: "127.0.0.1",
      body: { usuario: "moderador1", password: "incorrecta" },
    };
    const res: any = {};

    await iniciarSesionModerador(req, res, vi.fn());

    expect(registrarIntentoFallido).toHaveBeenCalledWith("127.0.0.1");
    expect(errorResponse).toHaveBeenCalledWith(res, "Credenciales invalidas", 401);
  });

  it("rechaza si la IP esta bloqueada por rate limiting", async () => {
    vi.mocked(estaBloqueado).mockResolvedValue(true);

    const req: any = { ip: "127.0.0.1", body: { usuario: "moderador1", password: "x" } };
    const res: any = {};

    await iniciarSesionModerador(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.",
      429
    );
    expect(buscarModeradorPorUsuario).not.toHaveBeenCalled();
  });

  it("rechaza el login de una cuenta de moderador bloqueada (SWAP-422)", async () => {
    vi.mocked(estaBloqueado).mockResolvedValue(false);
    vi.mocked(buscarModeradorPorUsuario).mockResolvedValue(moderadorMock("moderador", -1) as any);
    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(true);

    const req: any = { ip: "127.0.0.1", body: { usuario: "moderador1", password: "Moderador123!" } };
    const res: any = { cookie: vi.fn() };

    await iniciarSesionModerador(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(res, "Tu cuenta de moderador ha sido bloqueada.", 403);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("rechaza el login de una cuenta de moderador suspendida vigente (SWAP-422)", async () => {
    const suspendidaHasta = Math.floor(Date.now() / 1000) + 3600;
    vi.mocked(estaBloqueado).mockResolvedValue(false);
    vi.mocked(buscarModeradorPorUsuario).mockResolvedValue(moderadorMock("moderador", suspendidaHasta) as any);
    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(true);

    const req: any = { ip: "127.0.0.1", body: { usuario: "moderador1", password: "Moderador123!" } };
    const res: any = { cookie: vi.fn() };

    await iniciarSesionModerador(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(res, expect.stringContaining("suspendida hasta"), 403);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("permite el login y resetea tiempo_suspendido si la suspension de moderador ya expiro", async () => {
    const suspendidaHastaElPasado = Math.floor(Date.now() / 1000) - 3600;
    vi.mocked(estaBloqueado).mockResolvedValue(false);
    vi.mocked(buscarModeradorPorUsuario).mockResolvedValue(moderadorMock("moderador", suspendidaHastaElPasado) as any);
    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(true);
    vi.mocked(ServicioJWT.generarToken).mockReturnValue("jwt-token");

    const req: any = { ip: "127.0.0.1", body: { usuario: "moderador1", password: "Moderador123!" } };
    const res: any = { cookie: vi.fn() };

    await iniciarSesionModerador(req, res, vi.fn());

    expect(actualizarModerador).toHaveBeenCalledWith(1, { tiempo_suspendido: 0 });
    expect(res.cookie).toHaveBeenCalled();
    expect(exitoResponse).toHaveBeenCalled();
  });
});

describe("obtenerSesionModeradorActual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve los datos del moderador autenticado con su nivel", async () => {
    vi.mocked(buscarModeradorPorId).mockResolvedValue(moderadorMock("moderador") as any);

    const req: any = { usuario: { sub: "1", rol: "moderador" } };
    const res: any = {};

    await obtenerSesionModeradorActual(req, res, vi.fn());

    expect(exitoResponse).toHaveBeenCalledWith(
      res,
      { rol: "moderador", moderador: { id_moderador: 1, usuario: "moderador1", nivel: "moderador" } },
      "Sesion obtenida exitosamente",
      200
    );
  });

  it("devuelve nivel 'superadmin' cuando corresponde", async () => {
    vi.mocked(buscarModeradorPorId).mockResolvedValue(moderadorMock("superadmin") as any);

    const req: any = { usuario: { sub: "1", rol: "superadmin" } };
    const res: any = {};

    await obtenerSesionModeradorActual(req, res, vi.fn());

    expect(exitoResponse).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ rol: "superadmin", moderador: expect.objectContaining({ nivel: "superadmin" }) }),
      "Sesion obtenida exitosamente",
      200
    );
  });

  it("responde 401 si no hay usuario autenticado en el request", async () => {
    const req: any = { usuario: undefined };
    const res: any = {};

    await obtenerSesionModeradorActual(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(res, "Moderador no autenticado", 401);
    expect(buscarModeradorPorId).not.toHaveBeenCalled();
  });

  it("responde 404 si el moderador ya no existe", async () => {
    vi.mocked(buscarModeradorPorId).mockResolvedValue(null);

    const req: any = { usuario: { sub: "99", rol: "moderador" } };
    const res: any = {};

    await obtenerSesionModeradorActual(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(res, "Moderador no encontrado", 404);
  });
});
