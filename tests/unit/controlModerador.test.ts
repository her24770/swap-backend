import { describe, expect, it, vi, beforeEach } from "vitest";

import { iniciarSesionModerador, obtenerSesionModeradorActual } from "../../src/controlador/controlModerador";

import {
  buscarModeradorPorUsuario,
  buscarModeradorPorId,
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

describe("iniciarSesionModerador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite iniciar sesion con credenciales correctas y setea rol moderador", async () => {
    vi.mocked(estaBloqueado).mockResolvedValue(false);
    vi.mocked(buscarModeradorPorUsuario).mockResolvedValue({
      id_moderador: 1,
      usuario: "moderador1",
      password: "hash",
    } as any);
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
    vi.mocked(buscarModeradorPorUsuario).mockResolvedValue({
      id_moderador: 1,
      usuario: "moderador1",
      password: "hash",
    } as any);
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
});

describe("obtenerSesionModeradorActual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve los datos del moderador autenticado", async () => {
    vi.mocked(buscarModeradorPorId).mockResolvedValue({
      id_moderador: 1,
      usuario: "moderador1",
      password: "hash",
    } as any);

    const req: any = { usuario: { sub: "1", rol: "moderador" } };
    const res: any = {};

    await obtenerSesionModeradorActual(req, res, vi.fn());

    expect(exitoResponse).toHaveBeenCalledWith(
      res,
      { rol: "moderador", moderador: { id_moderador: 1, usuario: "moderador1" } },
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
