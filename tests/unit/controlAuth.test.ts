import { describe, expect, it, vi, beforeEach } from "vitest";

import { iniciarSesion, registro } from "../../src/controlador/controlAuth";

import {
  buscarUsuarioPorEmail,
  buscarUsuarioPorCarnet,
  guardarUsuario,
} from "../../src/repository/repositorioUsuario";
import {
  estaBloqueado,
  registrarIntentoFallido,
} from "../../src/autenticacion/rateLimiter";
import { ServicioBcrypt } from "../../src/autenticacion/ServicioBcrypt";
import { ServicioJWT } from "../../src/autenticacion/ServicioJWT";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";
import redis from "../../src/persistencia/redisClient";

vi.mock("../../src/repository/repositorioUsuario", () => ({
  buscarUsuarioPorEmail: vi.fn(),
  buscarUsuarioPorCarnet: vi.fn(),
  guardarUsuario: vi.fn(),
}));

vi.mock("../../src/autenticacion/ServicioBcrypt", () => ({
  ServicioBcrypt: {
    compararPassword: vi.fn(),
    hashearPassword: vi.fn(),
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

vi.mock("../../src/persistencia/redisClient", () => ({
  default: {
    get: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("../../src/autenticacion/rateLimiter", () => ({
  estaBloqueado: vi.fn(),
  registrarIntentoFallido: vi.fn(),
  limpiarIntentos: vi.fn(),
}));

describe("iniciarSesion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite iniciar sesión con credenciales correctas", async () => {
    const usuario = {
      id_usuario: 1,
      email_institucional: "test@test.com",
      password: "hash",
      nombre: "Juan",
    };

    vi.mocked(buscarUsuarioPorEmail).mockResolvedValue(usuario as any);

    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(true);

    vi.mocked(ServicioJWT.generarToken).mockReturnValue("jwt-token");

    const req: any = {
      ip: "127.0.0.1",
      body: {
        email_institucional: "test@test.com",
        password: "123456",
      },
    };

    const res: any = {
      cookie: vi.fn(),
    };

    const next = vi.fn();

    await iniciarSesion(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith(
      "swap-token",
      "jwt-token",
      expect.any(Object),
    );

    expect(exitoResponse).toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });

  it("rechaza contraseña incorrecta", async () => {
    vi.mocked(buscarUsuarioPorEmail).mockResolvedValue({
      id_usuario: 1,
      password: "hash",
      email_institucional: "test@test.com",
    } as any);

    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(false);

    vi.mocked(estaBloqueado).mockResolvedValue(false);

    vi.mocked(registrarIntentoFallido).mockResolvedValue(undefined);

    const req: any = {
      ip: "127.0.0.1",
      body: {
        email_institucional: "test@test.com",
        password: "wrong",
      },
    };

    const res: any = {};

    await iniciarSesion(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "Credenciales invalidas",
      401,
    );
  });

  it("rechaza usuario inexistente", async () => {
    vi.mocked(buscarUsuarioPorEmail).mockResolvedValue(null);

    const req: any = {
      ip: "127.0.0.1",
      body: {
        email_institucional: "no@test.com",
        password: "123",
      },
    };

    const res: any = {};

    await iniciarSesion(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "Credenciales invalidas",
      401,
    );
  });
});

describe("registro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra un usuario correctamente", async () => {
    vi.mocked(redis.get).mockResolvedValue("123456");

    vi.mocked(buscarUsuarioPorEmail).mockResolvedValue(null);

    vi.mocked(buscarUsuarioPorCarnet).mockResolvedValue(null);

    vi.mocked(ServicioBcrypt.hashearPassword).mockResolvedValue("hashed");

    vi.mocked(guardarUsuario).mockResolvedValue({
      id_usuario: 1,
      email_institucional: "test@test.com",
      password: "hashed",
    } as any);

    vi.mocked(ServicioJWT.generarToken).mockReturnValue("token");

    const req: any = {
      body: {
        codigo_verificacion: "123456",
        email_institucional: "TEST@test.com",
        carnet: "2025001",
        password: "123456",
      },
    };

    const res: any = {
      cookie: vi.fn(),
    };

    await registro(req, res, vi.fn());

    expect(guardarUsuario).toHaveBeenCalled();

    expect(exitoResponse).toHaveBeenCalled();
  });

  it("rechaza código de verificación incorrecto", async () => {
    vi.mocked(redis.get).mockResolvedValue("999999");

    const req: any = {
      body: {
        codigo_verificacion: "123456",
        email_institucional: "test@test.com",
      },
    };

    const res: any = {};

    await registro(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "Código de verificación inválido o expirado.",
      400,
    );
  });

  it("rechaza correo duplicado", async () => {
    vi.mocked(redis.get).mockResolvedValue("123456");

    vi.mocked(buscarUsuarioPorEmail).mockResolvedValue({
      id_usuario: 1,
    } as any);

    const req: any = {
      body: {
        codigo_verificacion: "123456",
        email_institucional: "test@test.com",
        carnet: "123",
        password: "123",
      },
    };

    const res: any = {};

    await registro(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "El correo institucional ya está registrado.",
      409,
    );
  });
});
