import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  autenticar,
  gestorPermisos,
  verificarPropietario,
} from "../../src/autenticacion/GestorPermisos";

import { ServicioJWT } from "../../src/autenticacion/ServicioJWT";
import { estaRevocado } from "../../src/autenticacion/blacklist";
import { obtenerVersionActual } from "../../src/autenticacion/servicioSesionVersion";
import { errorResponse } from "../../src/servicios/Response";

vi.mock("../../src/autenticacion/ServicioJWT", () => ({
  ServicioJWT: {
    verificarToken: vi.fn(),
  },
}));

vi.mock("../../src/autenticacion/blacklist", () => ({
  estaRevocado: vi.fn(),
}));

vi.mock("../../src/autenticacion/servicioSesionVersion", () => ({
  obtenerVersionActual: vi.fn(),
}));

vi.mock("../../src/servicios/Response", () => ({
  errorResponse: vi.fn(),
}));


describe("gestorPermisos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  it("permite acceso cuando el usuario tiene un rol permitido", () => {
    const req: any = {
      usuario: {
        rol: "ADMIN",
      },
    };

    const res: any = {};
    const next = vi.fn();

    const middleware = gestorPermisos("ADMIN");

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(errorResponse).not.toHaveBeenCalled();
  });


  it("rechaza acceso cuando el rol no está permitido", () => {
    const req: any = {
      usuario: {
        rol: "USER",
      },
    };

    const res: any = {};
    const next = vi.fn();

    const middleware = gestorPermisos("ADMIN");

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();

    expect(errorResponse)
      .toHaveBeenCalledWith(
        res,
        "No tienes permisos para realizar esta acción.",
        403
      );
  });


  it("rechaza acceso cuando no existe usuario", () => {
    const req: any = {};

    const res: any = {};
    const next = vi.fn();

    const middleware = gestorPermisos("ADMIN");

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();

    expect(errorResponse)
      .toHaveBeenCalledWith(
        res,
        "No tienes permisos para realizar esta acción.",
        403
      );
  });
});



describe("verificarPropietario", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });


  it("permite acceso si el id coincide con el token", () => {
    const req: any = {
      params: {
        id: "123",
      },
      usuario: {
        sub: "123",
      },
    };

    const res: any = {};
    const next = vi.fn();


    verificarPropietario(req, res, next);


    expect(next).toHaveBeenCalled();
    expect(errorResponse).not.toHaveBeenCalled();
  });


  it("rechaza si el id no coincide con el token", () => {
    const req: any = {
      params: {
        id: "123",
      },
      usuario: {
        sub: "456",
      },
    };

    const res: any = {};
    const next = vi.fn();


    verificarPropietario(req, res, next);


    expect(next).not.toHaveBeenCalled();

    expect(errorResponse)
      .toHaveBeenCalledWith(
        res,
        "No tienes permisos para realizar esta acción.",
        403
      );
  });


  it("rechaza si no existe token", () => {
    const req: any = {
      params: {
        id: "123",
      },
      usuario: undefined,
    };

    const res: any = {};
    const next = vi.fn();


    verificarPropietario(req, res, next);


    expect(next).not.toHaveBeenCalled();

    expect(errorResponse)
      .toHaveBeenCalledWith(
        res,
        "Token de autenticación requerido.",
        401
      );
  });


  it("acepta usuarioId como parámetro alternativo", () => {
    const req: any = {
      params: {
        usuarioId: "55",
      },
      usuario: {
        sub: "55",
      },
    };

    const res: any = {};
    const next = vi.fn();


    verificarPropietario(req, res, next);


    expect(next).toHaveBeenCalled();
  });

});



describe("autenticar", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });


  it("rechaza cuando no existe token", async () => {

    const req: any = {
      cookies: {},
      headers: {},
    };

    const res: any = {};
    const next = vi.fn();


    await autenticar(req, res, next);


    expect(errorResponse)
      .toHaveBeenCalledWith(
        res,
        "Token de autenticación requerido.",
        401
      );

    expect(next).not.toHaveBeenCalled();
  });



  it("rechaza token revocado", async () => {

    vi.mocked(estaRevocado)
      .mockResolvedValue(true);


    const req: any = {
      cookies: {
        "swap-token": "token123",
      },
      headers: {},
    };

    const res: any = {};
    const next = vi.fn();


    await autenticar(req, res, next);


    expect(errorResponse)
      .toHaveBeenCalledWith(
        res,
        "Sesión cerrada. Por favor inicia sesión nuevamente.",
        401
      );


    expect(next).not.toHaveBeenCalled();
  });



  it("permite acceso con token válido", async () => {

    vi.mocked(estaRevocado)
      .mockResolvedValue(false);


    vi.mocked(ServicioJWT.verificarToken)
      .mockReturnValue({
        sub: "1",
        rol: "usuario",
        email: "[EMAIL_ADDRESS]",
        ver: 3,
      });

    vi.mocked(obtenerVersionActual).mockResolvedValue(3);


    const req: any = {
      cookies: {
        "swap-token": "token123",
      },
      headers: {},
    };


    const res: any = {};
    const next = vi.fn();


    await autenticar(req, res, next);


    expect(req.usuario).toEqual({
      sub: "1",
      rol: "usuario",
      email: "[EMAIL_ADDRESS]",
      ver: 3,
    });


    expect(next).toHaveBeenCalled();
  });

  it("rechaza un token cuya versión de sesión quedó obsoleta", async () => {
    vi.mocked(estaRevocado).mockResolvedValue(false);
    vi.mocked(ServicioJWT.verificarToken).mockReturnValue({
      sub: "1",
      rol: "usuario",
      email: "test@test.com",
      ver: 2,
    });
    vi.mocked(obtenerVersionActual).mockResolvedValue(3);

    const req: any = { cookies: { "swap-token": "token123" }, headers: {} };
    const res: any = {};
    const next = vi.fn();

    await autenticar(req, res, next);

    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "Sesión inválida. Por favor inicia sesión nuevamente.",
      401,
    );
    expect(next).not.toHaveBeenCalled();
  });



  it("rechaza token inválido", async () => {

    vi.mocked(estaRevocado)
      .mockResolvedValue(false);


    vi.mocked(ServicioJWT.verificarToken)
      .mockImplementation(() => {
        throw new Error("Token inválido");
      });


    const req: any = {
      cookies: {
        "swap-token": "token123",
      },
      headers: {},
    };


    const res: any = {};
    const next = vi.fn();


    await autenticar(req, res, next);


    expect(errorResponse)
      .toHaveBeenCalledWith(
        res,
        "Token inválido",
        401
      );


    expect(next).not.toHaveBeenCalled();
  });

});
