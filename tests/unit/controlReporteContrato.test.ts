import { beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarEstadoReporte } from "../../src/controlador/controlReporte";
import {
    buscarEstadoReportePorNombre,
    buscarReportePorId,
    repoActualizarEstadoReporte,
} from "../../src/repository/repositorioReporte";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";

vi.mock("../../src/repository/repositorioReporte", () => ({
    buscarReportePorId: vi.fn(),
    buscarEstadoReportePorNombre: vi.fn(),
    repoActualizarEstadoReporte: vi.fn(),
    buscarReportesPaginados: vi.fn(),
    guardarReporte: vi.fn(),
    obtenerOCrearMotivoReportePorNombre: vi.fn(),
}));
vi.mock("../../src/repository/repositorioPublicacion", () => ({ buscarPublicacionPorId: vi.fn() }));
vi.mock("../../src/repository/repositorioResena", () => ({ buscarResenaPorId: vi.fn() }));
vi.mock("../../src/repository/repositorioEstado", () => ({ obtenerEstadoPorNombre: vi.fn() }));
vi.mock("../../src/repository/repositorioUsuario", () => ({
    actualizarUsuario: vi.fn(),
    buscarUsuarioPorId: vi.fn(),
}));
vi.mock("../../src/servicios/servicioR2", () => ({ subirImagenR2: vi.fn() }));
vi.mock("../../src/servicios/Response", () => ({
    errorResponse: vi.fn(),
    errorValidacionResponse: vi.fn(),
    exitoResponse: vi.fn(),
}));

describe("contrato de actualización de reportes", () => {
    beforeEach(() => vi.clearAllMocks());

    it("rechaza un id del body distinto del recurso indicado por la URL", async () => {
        const res = {} as any;
        await actualizarEstadoReporte({
            params: { id: "7" },
            body: { estado: "resuelto", id_reporte: 9 },
        } as any, res, vi.fn());

        expect(errorResponse).toHaveBeenCalledWith(
            res,
            "El ID del body no coincide con el ID de la ruta",
            400,
        );
        expect(buscarReportePorId).not.toHaveBeenCalled();
        expect(repoActualizarEstadoReporte).not.toHaveBeenCalled();
    });

    it("usa el id de la URL en la ruta PATCH canónica", async () => {
        vi.mocked(buscarReportePorId).mockResolvedValue({ id_reporte: 7 } as any);
        vi.mocked(buscarEstadoReportePorNombre).mockResolvedValue({ id_estado: 3 } as any);
        vi.mocked(repoActualizarEstadoReporte).mockResolvedValue({ id_reporte: 7, estado: 3 } as any);
        const res = {} as any;

        await actualizarEstadoReporte({
            params: { id: "7" },
            body: { estado: "resuelto" },
        } as any, res, vi.fn());

        expect(buscarReportePorId).toHaveBeenCalledWith(7);
        expect(repoActualizarEstadoReporte).toHaveBeenCalledWith(7, 3);
        expect(exitoResponse).toHaveBeenCalled();
    });
});
