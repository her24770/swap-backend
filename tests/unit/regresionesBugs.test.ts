import { beforeEach, describe, expect, it, vi } from "vitest";
import { schemaCrearCertificacion } from "../../src/modelo/schemaCertificacion";
import { schemaCrearReporte } from "../../src/modelo/schemaReporte";
import { schemaEditarPublicacion } from "../../src/modelo/schemaPublicacion";
import { schemaCrearResena } from "../../src/modelo/schemaResena";
import { crearSolicitarAcuerdo } from "../../src/controlador/controlAcuerdo";
import { buscarPublicacionPorId } from "../../src/repository/repositorioPublicacion";
import { buscarConversacionPorId } from "../../src/repository/repositorioMensaje";
import { contarAcuerdosActivosConversacion } from "../../src/repository/repositorioAcuerdo";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";

vi.mock("../../src/repository/repositorioPublicacion", () => ({ buscarPublicacionPorId: vi.fn() }));
vi.mock("../../src/repository/repositorioMensaje", () => ({ buscarConversacionPorId: vi.fn() }));
vi.mock("../../src/repository/repositorioAcuerdo", () => ({
  contarAcuerdosActivosConversacion: vi.fn(),
  existeSolicitudDuplicada: vi.fn(),
  crearAcuerdo: vi.fn(),
}));
vi.mock("../../src/repository/repositorioEstado", () => ({ obtenerEstadoPorNombre: vi.fn() }));
vi.mock("../../src/servicios/servicioAcuerdo", () => ({ notificarActualizacionAcuerdo: vi.fn() }));
vi.mock("../../src/servicios/Response", () => ({ errorResponse: vi.fn(), exitoResponse: vi.fn() }));

describe("regresiones BG-07 y BG-25", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza crear un acuerdo si el solicitante no participa en la conversación", async () => {
    vi.mocked(buscarPublicacionPorId).mockResolvedValue({
      id_publicacion: 8, id_usuario: 2, estadoRel: { estado: "activo" },
    } as any);
    vi.mocked(buscarConversacionPorId).mockResolvedValue({
      id_conversacion: 20, id_usuario_1: 3, id_usuario_2: 4,
    } as any);

    await crearSolicitarAcuerdo({
      params: { id: "8" }, usuario: { sub: "99" },
      body: { id_conversacion: 20, fecha_entrega: new Date(Date.now() + 86400000), lugar_entrega: "UVG", observaciones: "Entrega" },
    } as any, {} as any, vi.fn());

    expect(errorResponse).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("permiso"), 403);
    expect(contarAcuerdosActivosConversacion).not.toHaveBeenCalled();
    expect(exitoResponse).not.toHaveBeenCalled();
  });

  it("acepta los tipos enviados por formularios multipart y rechaza entradas inválidas", () => {
    expect(schemaCrearCertificacion.safeParse({ nombre: "AWS", lugar_emision: "Online", id_etiqueta: "3" }).success).toBe(true);
    expect(schemaEditarPublicacion.safeParse({ titulo: "Título válido", etiquetas: '[1,2]', imagenesEliminar: '["https://ejemplo.com/a.jpg"]' }).success).toBe(true);
    expect(schemaCrearReporte.safeParse({ tipo_objetivo: "usuario", id_objetivo: "4", motivo: "Spam o estafa" }).success).toBe(true);
    expect(schemaCrearResena.safeParse({ id_receptor: 4, tipo_resena: "Tutor", calificacion: 5, contenido: "Una reseña suficientemente larga." }).success).toBe(true);
    expect(schemaCrearResena.safeParse({ id_receptor: "no-numero", tipo_resena: "x", calificacion: 9, contenido: "x" }).success).toBe(false);
  });
});
