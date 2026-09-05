import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    buscarImagenesPorPublicacion,
    buscarPublicacionPorId,
    guardarImagen,
    guardarPublicacion,
    reemplazarEtiquetasPublicacion,
} from "../../src/repository/repositorioPublicacion";
import { obtenerTipoPerfilPorNombre } from "../../src/repository/repositorioTipoPerfil";
import { buscarUsuarioPorId } from "../../src/repository/repositorioUsuario";
import { obtenerEstadoPorNombre } from "../../src/repository/repositorioEstado";
import { subirImagenR2 } from "../../src/servicios/servicioR2";
import { crearPublicacion, editarPublicacion } from "../../src/servicios/servicioPublicacion";

vi.mock("../../src/repository/repositorioPublicacion", () => ({
    actualizarPublicacion: vi.fn(),
    buscarImagenesPorPublicacion: vi.fn(),
    buscarPublicacionPorId: vi.fn(),
    buscarPublicacionPorIdDetallado: vi.fn(),
    eliminarImagen: vi.fn(),
    eliminarPublicacionConRelaciones: vi.fn(),
    guardarImagen: vi.fn(),
    guardarPublicacion: vi.fn(),
    reemplazarEtiquetasPublicacion: vi.fn(),
}));
vi.mock("../../src/repository/repositorioTipoPerfil", () => ({ obtenerTipoPerfilPorNombre: vi.fn() }));
vi.mock("../../src/repository/repositorioUsuario", () => ({ buscarUsuarioPorId: vi.fn() }));
vi.mock("../../src/repository/repositorioEstado", () => ({ obtenerEstadoPorNombre: vi.fn() }));
vi.mock("../../src/servicios/servicioEmbedding", () => ({ generarYGuardarEmbedding: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../src/servicios/servicioModerarImagenesBackground", () => ({ moderarImagenesEnBackground: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../src/servicios/servicioR2", () => ({
    subirImagenR2: vi.fn(),
    eliminarImagenR2: vi.fn(),
}));

const archivo = {
    fieldname: "imagenes",
    buffer: Buffer.from("imagen"),
    mimetype: "image/png",
} as Express.Multer.File;

describe("servicioPublicacion", () => {
    beforeEach(() => vi.clearAllMocks());

    it("crea la publicación y coordina persistencia e imagen sin exponer Prisma al controlador", async () => {
        vi.mocked(buscarUsuarioPorId).mockResolvedValue({ id_usuario: 7 } as any);
        vi.mocked(obtenerTipoPerfilPorNombre).mockResolvedValue({ id_tipo_perfil: 2 } as any);
        vi.mocked(obtenerEstadoPorNombre).mockResolvedValue({ id_estado: 3 } as any);
        vi.mocked(guardarPublicacion).mockResolvedValue({ id_publicacion: 21 } as any);
        vi.mocked(subirImagenR2).mockResolvedValue("https://r2.test/imagen.png");
        vi.mocked(guardarImagen).mockResolvedValue({ id_imagen: 8 } as any);

        const resultado = await crearPublicacion({
            idUsuario: 7,
            datos: {
                titulo: "Libro de cálculo",
                descripcion: "Libro en muy buen estado",
                precio: 25,
                tipo_publicacion: "material",
                estado: "disponible",
                destacar: false,
                imagenes: [],
                etiquetas: [4, 5],
            },
            archivos: [archivo],
        });

        expect(guardarPublicacion).toHaveBeenCalledWith(
            expect.objectContaining({
                titulo: "Libro de cálculo",
                usuario: { connect: { id_usuario: 7 } },
            }),
            [4, 5],
        );
        expect(guardarImagen).toHaveBeenCalled();
        expect(resultado).toEqual({ id_publicacion: 21, imagenes: ["https://r2.test/imagen.png"] });
    });

    it("rechaza una edición ajena antes de mutar datos", async () => {
        vi.mocked(buscarPublicacionPorId).mockResolvedValue({ id_publicacion: 3, id_usuario: 9 } as any);

        await expect(editarPublicacion({
            idPublicacion: 3,
            idUsuario: 2,
            datos: { titulo: "Título actualizado" },
            archivos: [],
        })).rejects.toMatchObject({ status: 403 });

        expect(buscarImagenesPorPublicacion).not.toHaveBeenCalled();
        expect(reemplazarEtiquetasPublicacion).not.toHaveBeenCalled();
    });

    it("valida el máximo de imágenes antes de cambiar etiquetas", async () => {
        vi.mocked(buscarPublicacionPorId).mockResolvedValue({
            id_publicacion: 3,
            id_usuario: 2,
            titulo: "Original",
            descripcion: "Descripción original",
        } as any);
        vi.mocked(buscarImagenesPorPublicacion).mockResolvedValue(
            Array.from({ length: 5 }, (_, index) => ({
                id_imagen: index + 1,
                id_publicacion: 3,
                url_imagen: `https://r2.test/${index}.png`,
            })) as any,
        );

        await expect(editarPublicacion({
            idPublicacion: 3,
            idUsuario: 2,
            datos: { etiquetas: [1] },
            archivos: [archivo],
        })).rejects.toMatchObject({ status: 400 });

        expect(reemplazarEtiquetasPublicacion).not.toHaveBeenCalled();
    });
});
