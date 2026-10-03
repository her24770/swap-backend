import { beforeEach, describe, expect, it, vi } from "vitest";
import { editarPublicacion } from "../../src/controlador/controlPublicacion";
import {
    actualizarPublicacion,
    buscarImagenesPorPublicacion,
    buscarPublicacionPorId,
    eliminarImagen,
} from "../../src/repository/repositorioPublicacion";
import { eliminarImagenR2, subirImagenR2 } from "../../src/servicios/servicioR2";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";

vi.mock("../../src/repository/repositorioPublicacion", () => ({
    actualizarPublicacion: vi.fn(),
    buscarImagenesPorPublicacion: vi.fn(),
    buscarPublicacionPorId: vi.fn(),
    eliminarImagen: vi.fn(),
}));
vi.mock("../../src/servicios/servicioR2", () => ({
    eliminarImagenR2: vi.fn(),
    subirImagenR2: vi.fn(),
}));
vi.mock("../../src/servicios/Response", () => ({ errorResponse: vi.fn(), exitoResponse: vi.fn() }));
vi.mock("../../src/repository/repositorioTipoPerfil", () => ({ obtenerTipoPerfilPorNombre: vi.fn() }));
vi.mock("../../src/repository/repositorioUsuario", () => ({ buscarUsuarioPorId: vi.fn() }));
vi.mock("../../src/repository/repositorioEstado", () => ({ obtenerEstadoPorNombre: vi.fn() }));
vi.mock("../../src/servicios/servicioEmbedding", () => ({ generarYGuardarEmbedding: vi.fn() }));
vi.mock("../../src/autenticacion/eventoRecomendacion", () => ({ registrarInteraccionPublicacion: vi.fn() }));
vi.mock("../../src/servicios/servicioModeracion", () => ({
    notificarAccionModeracion: vi.fn(),
    obtenerJustificanteModeracion: vi.fn(),
}));
vi.mock("../../src/repository/repositorioReporte", () => ({ buscarReportesPorPublicacion: vi.fn() }));

describe("editarPublicacion", () => {
    beforeEach(() => vi.clearAllMocks());

    it("valida el límite de imágenes antes de mutar la publicación", async () => {
        vi.mocked(buscarPublicacionPorId).mockResolvedValue({ id_publicacion: 1, id_usuario: 7 } as any);
        vi.mocked(buscarImagenesPorPublicacion).mockResolvedValue(
            Array.from({ length: 5 }, (_, i) => ({ id_imagen: i + 1, url_imagen: `imagen-${i + 1}` })) as any,
        );

        await editarPublicacion({
            params: { id: "1" },
            usuario: { sub: "7" },
            body: { titulo: "Título actualizado" },
            files: [{ fieldname: "imagenes", buffer: Buffer.from("imagen") }],
        } as any, {} as any, vi.fn());

        expect(errorResponse).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("máximo es 5"), 400);
        expect(actualizarPublicacion).not.toHaveBeenCalled();
        expect(eliminarImagen).not.toHaveBeenCalled();
        expect(eliminarImagenR2).not.toHaveBeenCalled();
        expect(subirImagenR2).not.toHaveBeenCalled();
        expect(exitoResponse).not.toHaveBeenCalled();
    });
});
