import { describe, expect, it, vi, beforeEach } from "vitest";

import { subirFotoPerfil } from "../../src/controlador/controlImagen";
import { subirImagenR2, eliminarImagenR2 } from "../../src/servicios/servicioR2";
import { buscarUsuarioPorId, actualizarUsuario } from "../../src/repository/repositorioUsuario";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";
import { analizarImagen } from "../../src/servicios/servicioModeracionImagen";

vi.mock("../../src/servicios/servicioR2", () => ({
  subirImagenR2: vi.fn(),
  eliminarImagenR2: vi.fn(),
  construirUrlR2: vi.fn(() => "https://r2.example.com/perfil/default.png"),
}));

vi.mock("../../src/repository/repositorioUsuario", () => ({
  buscarUsuarioPorId: vi.fn(),
  actualizarUsuario: vi.fn(),
}));

vi.mock("../../src/servicios/Response", () => ({
  errorResponse: vi.fn(),
  exitoResponse: vi.fn(),
}));

vi.mock("../../src/servicios/servicioModeracionImagen", () => ({
  analizarImagen: vi.fn().mockResolvedValue({ flagged: false }),
}));

vi.mock("../../src/repository/repositorioNotificacion", () => ({
  crearNotificacion: vi.fn(),
}));

vi.mock("../../src/repository/repositorioEstado", () => ({
  obtenerEstadoPorNombre: vi.fn(),
}));

function reqConArchivo(idUsuario: number) {
  return {
    file: { buffer: Buffer.from("img"), mimetype: "image/png" },
    params: { id: String(idUsuario) },
  } as any;
}

describe("subirFotoPerfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analizarImagen).mockResolvedValue({ flagged: false } as any);
  });

  it("sube la imagen nueva, actualiza la BD y solo entonces borra la anterior", async () => {
    vi.mocked(buscarUsuarioPorId).mockResolvedValue({ url_foto_perfil: "https://r2.example.com/perfil/user_1_old.png" } as any);
    vi.mocked(subirImagenR2).mockResolvedValue("https://r2.example.com/perfil/user_1_new.png");
    vi.mocked(actualizarUsuario).mockResolvedValue({} as any);

    const res: any = {};
    await subirFotoPerfil(reqConArchivo(1), res, vi.fn());

    // La BD se actualiza con la URL nueva antes de responder.
    expect(actualizarUsuario).toHaveBeenCalledWith(1, { url_foto_perfil: "https://r2.example.com/perfil/user_1_new.png" });

    // La imagen anterior solo se borra después de que la BD confirmó la nueva.
    expect(eliminarImagenR2).toHaveBeenCalledWith("https://r2.example.com/perfil/user_1_old.png");
    expect(eliminarImagenR2).toHaveBeenCalledTimes(1);

    expect(exitoResponse).toHaveBeenCalledWith(
      res,
      "https://r2.example.com/perfil/user_1_new.png",
      "Foto de perfil actualizada",
      201
    );
  });

  it("si la BD falla, borra la imagen recién subida (compensación) y no toca la anterior", async () => {
    vi.mocked(buscarUsuarioPorId).mockResolvedValue({ url_foto_perfil: "https://r2.example.com/perfil/user_1_old.png" } as any);
    vi.mocked(subirImagenR2).mockResolvedValue("https://r2.example.com/perfil/user_1_new.png");
    vi.mocked(actualizarUsuario).mockRejectedValue(new Error("DB caída"));

    const res: any = {};
    const next = vi.fn();
    await subirFotoPerfil(reqConArchivo(1), res, next);

    // Se compensa borrando la imagen nueva recién subida (no queda huérfana en R2).
    expect(eliminarImagenR2).toHaveBeenCalledWith("https://r2.example.com/perfil/user_1_new.png");

    // La imagen anterior NUNCA se toca, porque la BD nunca confirmó el cambio.
    expect(eliminarImagenR2).not.toHaveBeenCalledWith("https://r2.example.com/perfil/user_1_old.png");
    expect(eliminarImagenR2).toHaveBeenCalledTimes(1);

    // El error se propaga en vez de responder éxito falso.
    expect(next).toHaveBeenCalled();
    expect(exitoResponse).not.toHaveBeenCalled();
  });

  it("si falla la subida a R2, nunca borra la imagen anterior", async () => {
    vi.mocked(buscarUsuarioPorId).mockResolvedValue({ url_foto_perfil: "https://r2.example.com/perfil/user_1_old.png" } as any);
    vi.mocked(subirImagenR2).mockRejectedValue(new Error("R2 caído"));

    const res: any = {};
    const next = vi.fn();
    await subirFotoPerfil(reqConArchivo(1), res, next);

    expect(eliminarImagenR2).not.toHaveBeenCalled();
    expect(actualizarUsuario).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("si el usuario no tenía foto anterior, no intenta borrar nada", async () => {
    vi.mocked(buscarUsuarioPorId).mockResolvedValue({ url_foto_perfil: null } as any);
    vi.mocked(subirImagenR2).mockResolvedValue("https://r2.example.com/perfil/user_1_new.png");
    vi.mocked(actualizarUsuario).mockResolvedValue({} as any);

    const res: any = {};
    await subirFotoPerfil(reqConArchivo(1), res, vi.fn());

    expect(eliminarImagenR2).not.toHaveBeenCalled();
    expect(exitoResponse).toHaveBeenCalledWith(
      res,
      "https://r2.example.com/perfil/user_1_new.png",
      "Foto de perfil agregada",
      201
    );
  });
});
