import { describe, expect, it, vi, beforeEach } from "vitest";

import { iniciarSesion, registro, restablecerPassword } from "../../src/controlador/controlAuth";

import {
  buscarUsuarioPorEmail,
  buscarUsuarioPorCarnet,
  guardarUsuario,
  actualizarUsuario,
} from "../../src/repository/repositorioUsuario";
import {
  estaBloqueado,
  registrarIntento,
} from "../../src/autenticacion/rateLimiter";
import { ServicioBcrypt } from "../../src/autenticacion/ServicioBcrypt";
import { ServicioJWT } from "../../src/autenticacion/ServicioJWT";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";
import redis from "../../src/persistencia/redisClient";

vi.mock("../../src/repository/repositorioUsuario", () => ({
  buscarUsuarioPorEmail: vi.fn(),
  buscarUsuarioPorCarnet: vi.fn(),
  guardarUsuario: vi.fn(),
  actualizarUsuario: vi.fn(),
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
  registrarIntento: vi.fn(),
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
      tiempo_suspendido: 0,
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

    vi.mocked(registrarIntento).mockResolvedValue(undefined);

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

  it("rechaza el login de una cuenta bloqueada (SWAP-422)", async () => {
    vi.mocked(buscarUsuarioPorEmail).mockResolvedValue({
      id_usuario: 1,
      email_institucional: "test@test.com",
      password: "hash",
      tiempo_suspendido: -1,
    } as any);
    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(true);

    const req: any = {
      ip: "127.0.0.1",
      body: { email_institucional: "test@test.com", password: "123456" },
    };
    const res: any = { cookie: vi.fn() };

    await iniciarSesion(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "Tu cuenta ha sido bloqueada. Contacta a un moderador.",
      403,
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("rechaza el login de una cuenta suspendida vigente (SWAP-422)", async () => {
    const suspendidaHasta = Math.floor(Date.now() / 1000) + 3600;
    vi.mocked(buscarUsuarioPorEmail).mockResolvedValue({
      id_usuario: 1,
      email_institucional: "test@test.com",
      password: "hash",
      tiempo_suspendido: suspendidaHasta,
    } as any);
    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(true);

    const req: any = {
      ip: "127.0.0.1",
      body: { email_institucional: "test@test.com", password: "123456" },
    };
    const res: any = { cookie: vi.fn() };

    await iniciarSesion(req, res, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      expect.stringContaining("suspendida hasta"),
      403,
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("permite el login y resetea tiempo_suspendido si la suspension ya expiro", async () => {
    const suspendidaHastaElPasado = Math.floor(Date.now() / 1000) - 3600;
    vi.mocked(buscarUsuarioPorEmail).mockResolvedValue({
      id_usuario: 1,
      email_institucional: "test@test.com",
      password: "hash",
      tiempo_suspendido: suspendidaHastaElPasado,
    } as any);
    vi.mocked(ServicioBcrypt.compararPassword).mockResolvedValue(true);
    vi.mocked(ServicioJWT.generarToken).mockReturnValue("jwt-token");

    const req: any = {
      ip: "127.0.0.1",
      body: { email_institucional: "test@test.com", password: "123456" },
    };
    const res: any = { cookie: vi.fn() };

    await iniciarSesion(req, res, vi.fn());

    expect(actualizarUsuario).toHaveBeenCalledWith(1, { tiempo_suspendido: 0 });
    expect(res.cookie).toHaveBeenCalled();
    expect(exitoResponse).toHaveBeenCalled();
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

describe("restablecerPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("actualiza la contraseña e invalida las sesiones en el mismo UPDATE", async () => {
    vi.mocked(redis.get).mockResolvedValue("123456");
    vi.mocked(buscarUsuarioPorEmail).mockResolvedValue({ id_usuario: 8 } as any);
    vi.mocked(ServicioBcrypt.hashearPassword).mockResolvedValue("nuevo-hash");

    const req: any = {
      body: {
        email: "usuario@uvg.edu.gt",
        code: "123456",
        newPassword: "NuevaClave1",
      },
    };
    const res: any = {};

    await restablecerPassword(req, res, vi.fn());

    expect(actualizarUsuario).toHaveBeenCalledWith(8, {
      password: "nuevo-hash",
      sesion_version: { increment: 1 },
    });
    expect(redis.del).toHaveBeenCalled();
    expect(exitoResponse).toHaveBeenCalled();
  });
});
