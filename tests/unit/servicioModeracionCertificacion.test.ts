import { describe, expect, it, vi, beforeEach } from "vitest";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import {
    moderarYValidarPdfCertificacion,
    validarEstructuraYSeguridadPdf,
    ejecutarConReintentos,
    RechazoValidacionPdfError,
    RechazoModeracionPdfError,
    ErrorTecnicoPdfError,
} from "../../src/servicios/servicioModeracionCertificacion";
import { procesarCertificacionEnBackground } from "../../src/servicios/servicioModerarCertificacionBackground";
import { analizarTexto } from "../../src/servicios/servicioModeracionTexto";
import { analizarImagen } from "../../src/servicios/servicioModeracionImagen";
import { notificarAccionModeracion } from "../../src/servicios/servicioModeracion";
import { crearCertificacionUsuario } from "../../src/controlador/controlCertificacion";
import {
    buscarCertificacionDuplicada,
    crearCertificacion,
    contarCertificacionesPorUsuario,
} from "../../src/repository/repositorioCertificacion";
import { buscarUsuarioPorId } from "../../src/repository/repositorioUsuario";
import { verificarEtiquetasExisten } from "../../src/repository/repositorioEtiqueta";
import { subirImagenR2, eliminarImagenR2 } from "../../src/servicios/servicioR2";
import { errorResponse, exitoResponse } from "../../src/servicios/Response";

// Mocks de dependencias externas
vi.mock("../../src/servicios/servicioModeracionTexto", () => ({
    analizarTexto: vi.fn(),
}));

vi.mock("../../src/servicios/servicioModeracionImagen", () => ({
    analizarImagen: vi.fn(),
}));

vi.mock("../../src/servicios/servicioModeracion", () => ({
    notificarAccionModeracion: vi.fn(),
}));

vi.mock("../../src/servicios/servicioR2", () => ({
    subirImagenR2: vi.fn(),
    eliminarImagenR2: vi.fn(),
}));

vi.mock("../../src/repository/repositorioCertificacion", () => ({
    buscarCertificacionDuplicada: vi.fn(),
    crearCertificacion: vi.fn(),
    contarCertificacionesPorUsuario: vi.fn(),
    buscarCertificacionesPorUsuario: vi.fn(),
    buscarCertificacionPorId: vi.fn(),
    eliminarCertificacion: vi.fn(),
}));

vi.mock("../../src/repository/repositorioUsuario", () => ({
    buscarUsuarioPorId: vi.fn(),
}));

vi.mock("../../src/repository/repositorioEtiqueta", () => ({
    verificarEtiquetasExisten: vi.fn(),
}));

vi.mock("../../src/servicios/Response", () => ({
    errorResponse: vi.fn(),
    exitoResponse: vi.fn(),
    errorValidacionResponse: vi.fn(),
}));

// Generadores de PDFs para pruebas
async function crearPdfConTexto(paginas: number = 1, texto: string = "Certificado de Honor"): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < paginas; i++) {
        const page = doc.addPage([400, 400]);
        if (texto) {
            page.drawText(texto, { x: 50, y: 350, size: 16 });
        }
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
}

async function crearPdfConLink(url: string = "https://malicious-link.com"): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 400]);
    const linkAnnot = doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [0, 0, 100, 100],
        A: {
            Type: "Action",
            S: "URI",
            URI: PDFString.of(url),
        },
    });
    const linkAnnotRef = doc.context.register(linkAnnot);
    page.node.set(PDFName.of("Annots"), doc.context.obj([linkAnnotRef]));
    const bytes = await doc.save();
    return Buffer.from(bytes);
}

async function crearPdfConJavaScript(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    const jsAction = doc.context.obj({
        Type: "Action",
        S: "JavaScript",
        JS: PDFString.of("app.alert('malicious');"),
    });
    doc.catalog.set(PDFName.of("OpenAction"), doc.context.register(jsAction));
    const bytes = await doc.save();
    return Buffer.from(bytes);
}

describe("Moderación y Validación de PDFs de Certificaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(analizarTexto).mockResolvedValue({ flagged: false, categorias: [] } as any);
        vi.mocked(analizarImagen).mockResolvedValue({ flagged: false, etiquetas: [] } as any);
        vi.mocked(subirImagenR2).mockResolvedValue("https://r2.example.com/certificaciones/cert_1.pdf");
        vi.mocked(eliminarImagenR2).mockResolvedValue(undefined);
        vi.mocked(buscarCertificacionDuplicada).mockResolvedValue(null);
        vi.mocked(buscarUsuarioPorId).mockResolvedValue({ id_usuario: 1, nombre: "Usuario Test" } as any);
        vi.mocked(verificarEtiquetasExisten).mockResolvedValue(true as any);
        vi.mocked(contarCertificacionesPorUsuario).mockResolvedValue(0);
    });

    // Caso 1
    it("1. PDF válido de hasta 2 páginas pasa todas las validaciones y moderaciones", async () => {
        const pdfBuffer = await crearPdfConTexto(2, "Certificado de Participación");

        await expect(moderarYValidarPdfCertificacion(pdfBuffer)).resolves.not.toThrow();

        expect(analizarTexto).toHaveBeenCalledTimes(1);
        expect(analizarImagen).toHaveBeenCalledTimes(2);
    });

    // Caso 2
    it("2. PDF sin texto significativo omite la moderación textual y continúa con la moderación visual", async () => {
        const pdfBuffer = await crearPdfConTexto(1, ""); // Sin texto

        await expect(moderarYValidarPdfCertificacion(pdfBuffer)).resolves.not.toThrow();

        // Omitida llamada a OpenAI Moderation
        expect(analizarTexto).not.toHaveBeenCalled();
        // Moderación visual requerida para la página
        expect(analizarImagen).toHaveBeenCalledTimes(1);
    });

    // Caso 3
    it("3. PDF que incumple una restricción (> 2 páginas) es rechazado inmediatamente sin moderación ni S3", async () => {
        const pdfBuffer = await crearPdfConTexto(3, "Certificado de 3 páginas");

        await expect(moderarYValidarPdfCertificacion(pdfBuffer)).rejects.toThrow(
            RechazoValidacionPdfError
        );

        expect(analizarTexto).not.toHaveBeenCalled();
        expect(analizarImagen).not.toHaveBeenCalled();
    });

    // Caso 4
    it("4. PDF cuyo contenido es rechazado por moderación de texto o visual no pasa la validación", async () => {
        const pdfBuffer = await crearPdfConTexto(1, "Texto ofensivo");

        // Rechazo por texto (en paralelo)
        vi.mocked(analizarTexto).mockResolvedValueOnce({ flagged: true, categorias: ["harassment"] } as any);
        vi.mocked(analizarImagen).mockResolvedValueOnce({ flagged: false, etiquetas: [] } as any);

        await expect(moderarYValidarPdfCertificacion(pdfBuffer)).rejects.toThrow(
            RechazoModeracionPdfError
        );

        // Rechazo por imagen
        vi.mocked(analizarTexto).mockResolvedValueOnce({ flagged: false, categorias: [] } as any);
        vi.mocked(analizarImagen).mockResolvedValueOnce({ flagged: true, etiquetas: ["Explicit Nudity"] } as any);

        await expect(moderarYValidarPdfCertificacion(pdfBuffer)).rejects.toThrow(
            RechazoModeracionPdfError
        );
    });

    // Caso 5
    it("5. Fallo reintentable de un servicio externo realiza retries limitados (3 máx) y arroja error temporal", async () => {
        let intentos = 0;
        const operacionFallida = vi.fn().mockImplementation(async () => {
            intentos++;
            throw new Error("503 Service Unavailable");
        });

        await expect(ejecutarConReintentos(operacionFallida, 3, 10)).rejects.toThrow(
            ErrorTecnicoPdfError
        );

        expect(intentos).toBe(3);
    });

    // Caso 6
    it("6. Error de validación o rechazo de moderación no realiza reintentos innecesarios", async () => {
        let intentos = 0;
        const operacionRechazo = vi.fn().mockImplementation(async () => {
            intentos++;
            throw new RechazoModeracionPdfError("Contenido prohibido");
        });

        await expect(ejecutarConReintentos(operacionRechazo, 3, 10)).rejects.toThrow(
            RechazoModeracionPdfError
        );

        // Se detiene al primer intento sin reintentar
        expect(intentos).toBe(1);
    });

    // Caso 7
    it("7. PDF que contiene una URL escrita como texto pero sin enlace interactivo no es rechazado por ese motivo", async () => {
        const pdfBuffer = await crearPdfConTexto(
            1,
            "Verifica este diploma en https://universidad.edu.gt/validar o escanea el QR"
        );

        await expect(validarEstructuraYSeguridadPdf(pdfBuffer)).resolves.toBeDefined();
    });

    // Caso 8
    it("8. PDF con enlace interactivo o JavaScript es rechazado antes de la moderación externa", async () => {
        const pdfConLink = await crearPdfConLink("https://enlace-externo.com");
        await expect(validarEstructuraYSeguridadPdf(pdfConLink)).rejects.toThrow(
            RechazoValidacionPdfError
        );

        const pdfConJs = await crearPdfConJavaScript();
        await expect(validarEstructuraYSeguridadPdf(pdfConJs)).rejects.toThrow(
            RechazoValidacionPdfError
        );
    });

    // Caso 9
    it("9. Certificación duplicada es rechazada anticipadamente sin procesar el PDF ni invocar R2", async () => {
        vi.mocked(buscarCertificacionDuplicada).mockResolvedValueOnce({
            id_certificacion: 99,
            id_usuario: 1,
            nombre: "Diplomado TypeScript",
            lugar_emision: "Universidad X",
            id_etiqueta: 5,
            ruta_pdf: "https://r2.example.com/anterior.pdf",
        } as any);

        const req: any = {
            body: {
                nombre: "Diplomado TypeScript",
                lugar_emision: "Universidad X",
                id_etiqueta: "5",
            },
            file: {
                buffer: await crearPdfConTexto(1, "Texto"),
                mimetype: "application/pdf",
                size: 1000,
            },
            usuario: { sub: "1" },
        };
        const res: any = {};
        const next = vi.fn();

        await crearCertificacionUsuario(req, res, next);

        expect(errorResponse).toHaveBeenCalledWith(
            res,
            "Ya existe una certificación con el mismo nombre, lugar de emisión y etiqueta para este usuario.",
            400
        );
        expect(subirImagenR2).not.toHaveBeenCalled();
    });

    // Caso 10
    it("10. Fallo de persistencia tras upload exitoso a R2 ejecuta compensación eliminando el archivo huérfano", async () => {
        const pdfBuffer = await crearPdfConTexto(1, "Certificado Válido");

        // Subida a R2 exitosa, pero falla la BD en background
        vi.mocked(subirImagenR2).mockResolvedValueOnce("https://r2.example.com/cert_huerfano.pdf");
        vi.mocked(crearCertificacion).mockRejectedValueOnce(new Error("Conexión perdida con la base de datos"));

        await procesarCertificacionEnBackground({
            idUsuario: 1,
            datos: {
                nombre: "Certificación AWS",
                lugar_emision: "Amazon",
                id_etiqueta: 2,
            },
            buffer: pdfBuffer,
            mimetype: "application/pdf",
        });

        // Se verifica que la compensación eliminó el archivo subido en R2
        expect(eliminarImagenR2).toHaveBeenCalledWith("https://r2.example.com/cert_huerfano.pdf");
        // Notificación de error temporal al usuario
        expect(notificarAccionModeracion).toHaveBeenCalledWith(
            1,
            expect.stringContaining("No fue posible procesar tu certificación")
        );
    });

    it("11. Controlador responde 202 Accepted de inmediato y encola la certificación en background", async () => {
        const pdfBuffer = await crearPdfConTexto(1, "Certificado Válido");
        const req: any = {
            body: {
                nombre: "Certificación Node.js",
                lugar_emision: "OpenJS",
                id_etiqueta: "3",
            },
            file: {
                buffer: pdfBuffer,
                mimetype: "application/pdf",
                size: pdfBuffer.length,
            },
            usuario: { sub: "1" },
        };
        const res: any = {};
        const next = vi.fn();

        await crearCertificacionUsuario(req, res, next);

        expect(exitoResponse).toHaveBeenCalledWith(
            res,
            { estado: "en_proceso" },
            expect.stringContaining("Tu certificación está siendo procesada"),
            202
        );
    });
});
