import { describe, expect, it, vi, beforeEach } from "vitest";
import { soloModerador, soloSuperadmin } from "../../src/autenticacion/permisosModerador";
import { errorResponse } from "../../src/servicios/Response";

vi.mock("../../src/servicios/Response", () => ({
  errorResponse: vi.fn(),
}));

describe("soloModerador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deja pasar a un moderador nivel base", () => {
    const req: any = { usuario: { rol: "moderador" } };
    const res: any = {};
    const next = vi.fn();

    soloModerador(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(errorResponse).not.toHaveBeenCalled();
  });

  it("deja pasar a un superadmin", () => {
    const req: any = { usuario: { rol: "superadmin" } };
    const res: any = {};
    const next = vi.fn();

    soloModerador(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("rechaza a un usuario normal", () => {
    const req: any = { usuario: { rol: "usuario" } };
    const res: any = {};
    const next = vi.fn();

    soloModerador(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "No tienes permisos para realizar esta acción.",
      403
    );
  });
});

describe("soloSuperadmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deja pasar a un superadmin", () => {
    const req: any = { usuario: { rol: "superadmin" } };
    const res: any = {};
    const next = vi.fn();

    soloSuperadmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("rechaza a un moderador nivel base", () => {
    const req: any = { usuario: { rol: "moderador" } };
    const res: any = {};
    const next = vi.fn();

    soloSuperadmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalledWith(
      res,
      "No tienes permisos para realizar esta acción.",
      403
    );
  });
});
