import { beforeEach, describe, expect, it, vi } from "vitest";
import { editarPublicacion } from "../../src/controlador/controlPublicacion";
import {
    actualizarPublicacion,
    buscarImagenesPorPublicacion,
    buscarPublicacionPorId,
    eliminarImagen,
    guardarImagen,
    reemplazarEtiquetasPublicacion,
} from "../../src/repository/repositorioPublicacion";
import { eliminarImagenR2, subirImagenR2 } from "../../src/servicios/servicioR2";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";

vi.mock("../../src/repository/repositorioPublicacion", () => ({
    actualizarPublicacion: vi.fn(),
    buscarImagenesPorPublicacion: vi.fn(),
    buscarPublicacionPorId: vi.fn(),
    eliminarImagen: vi.fn(),
    guardarImagen: vi.fn(),
    reemplazarEtiquetasPublicacion: vi.fn(),
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
vi.mock("../../src/servicios/servicioModerarImagenesBackground", () => ({ moderarImagenesEnBackground: vi.fn() }));
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

    it("actualiza campos de texto y persiste imágenes cuando viajan ambos en la petición", async () => {
        vi.mocked(buscarPublicacionPorId).mockResolvedValue({
            id_publicacion: 1,
            id_usuario: 7,
            titulo: "Título original",
            descripcion: "Descripción original",
        } as any);
        vi.mocked(buscarImagenesPorPublicacion).mockResolvedValue([
            { id_imagen: 10, id_publicacion: 1, url_imagen: "https://r2.test/nueva.png" } as any,
        ]);
        vi.mocked(subirImagenR2).mockResolvedValue("https://r2.test/nueva.png");
        vi.mocked(guardarImagen).mockResolvedValue({
            id_imagen: 10,
            id_publicacion: 1,
            url_imagen: "https://r2.test/nueva.png",
        } as any);

        const res = {} as any;
        await editarPublicacion({
            params: { id: "1" },
            usuario: { sub: "7" },
            body: { titulo: "Título nuevo", descripcion: "Descripción nueva", precio: 50 },
            files: [{ fieldname: "imagenes", buffer: Buffer.from("img"), mimetype: "image/png" }],
        } as any, res, vi.fn());

        expect(actualizarPublicacion).toHaveBeenCalledWith(1, {
            titulo: "Título nuevo",
            descripcion: "Descripción nueva",
            precio: 50,
        });
        expect(subirImagenR2).toHaveBeenCalledWith(expect.any(Buffer), "image/png", "publicaciones", expect.stringContaining("post_1_"));
        expect(guardarImagen).toHaveBeenCalledWith({
            url_imagen: "https://r2.test/nueva.png",
            publicacion: { connect: { id_publicacion: 1 } },
        });
        expect(exitoResponse).toHaveBeenCalledWith(
            res,
            {
                imagenes: [{ id_imagen: 10, id_publicacion: 1, url_imagen: "https://r2.test/nueva.png" }],
                urlsNuevas: ["https://r2.test/nueva.png"],
            },
            "Publicacion actualizada exitosamente",
            200
        );
    });

    it("soporta archivos provistos como objeto de campos (upload.fields)", async () => {
        vi.mocked(buscarPublicacionPorId).mockResolvedValue({
            id_publicacion: 2,
            id_usuario: 7,
            titulo: "Viejo",
        } as any);
        vi.mocked(buscarImagenesPorPublicacion).mockResolvedValue([]);
        vi.mocked(subirImagenR2).mockResolvedValue("https://r2.test/campo.png");
        vi.mocked(guardarImagen).mockResolvedValue({
            id_imagen: 20,
            id_publicacion: 2,
            url_imagen: "https://r2.test/campo.png",
        } as any);

        const res = {} as any;
        await editarPublicacion({
            params: { id: "2" },
            usuario: { sub: "7" },
            body: { titulo: "Nuevo" },
            files: {
                imagenes: [{ fieldname: "imagenes", buffer: Buffer.from("img"), mimetype: "image/png" }],
            },
        } as any, res, vi.fn());

        expect(actualizarPublicacion).toHaveBeenCalledWith(2, { titulo: "Nuevo" });
        expect(subirImagenR2).toHaveBeenCalled();
        expect(guardarImagen).toHaveBeenCalled();
        expect(exitoResponse).toHaveBeenCalledWith(res, expect.anything(), expect.any(String), 200);
    });

    it("elimina imágenes seleccionadas en imagenesEliminar y carga nuevas", async () => {
        vi.mocked(buscarPublicacionPorId).mockResolvedValue({
            id_publicacion: 3,
            id_usuario: 7,
        } as any);
        vi.mocked(buscarImagenesPorPublicacion).mockResolvedValue([
            { id_imagen: 1, id_publicacion: 3, url_imagen: "https://r2.test/vieja.png" } as any,
        ]);
        vi.mocked(subirImagenR2).mockResolvedValue("https://r2.test/reemplazo.png");
        vi.mocked(guardarImagen).mockResolvedValue({
            id_imagen: 2,
            id_publicacion: 3,
            url_imagen: "https://r2.test/reemplazo.png",
        } as any);

        const res = {} as any;
        await editarPublicacion({
            params: { id: "3" },
            usuario: { sub: "7" },
            body: {
                imagenesEliminar: ["https://r2.test/vieja.png"],
            },
            files: [{ fieldname: "imagenes", buffer: Buffer.from("img"), mimetype: "image/png" }],
        } as any, res, vi.fn());

        expect(eliminarImagenR2).toHaveBeenCalledWith("https://r2.test/vieja.png");
        expect(eliminarImagen).toHaveBeenCalledWith(1);
        expect(subirImagenR2).toHaveBeenCalledWith(expect.any(Buffer), "image/png", "publicaciones", expect.stringContaining("post_3_"));
        expect(guardarImagen).toHaveBeenCalled();
        expect(exitoResponse).toHaveBeenCalled();
    });
});
