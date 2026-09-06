import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { analizarTexto } from "./servicioModeracionTexto.js";
import { analizarImagen } from "./servicioModeracionImagen.js";

/**
 * Error cuando el PDF es rechazado por reglas de validación estructural,
 * formato, tamaño, páginas o características de seguridad no permitidas.
 */
export class RechazoValidacionPdfError extends Error {
    constructor(mensaje: string) {
        super(mensaje);
        this.name = "RechazoValidacionPdfError";
    }
}

/**
 * Error cuando el contenido del PDF es rechazado por políticas de moderación
 * (texto u orden visual de páginas).
 */
export class RechazoModeracionPdfError extends Error {
    constructor(mensaje: string) {
        super(mensaje);
        this.name = "RechazoModeracionPdfError";
    }
}

/**
 * Error técnico o indisponibilidad temporal de servicios externos tras agotar reintentos.
 */
export class ErrorTecnicoPdfError extends Error {
    constructor(mensaje: string = "El servicio no está disponible en este momento. Intenta nuevamente en unos minutos.") {
        super(mensaje);
        this.name = "ErrorTecnicoPdfError";
    }
}

/**
 * Ejecuta una operación asíncrona con hasta maxIntentos reintentos en caso
 * de fallos temporales (red, errores 5xx, indisponibilidad).
 * No realiza reintentos si el error es de validación o rechazo de moderación.
 */
export async function ejecutarConReintentos<T>(
    operacion: () => Promise<T>,
    maxIntentos: number = 3,
    delayMs: number = 300
): Promise<T> {
    let ultimoError: any;
    for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
            return await operacion();
        } catch (error: any) {
            ultimoError = error;

            // No reintentar rechazos de validación ni de moderación deterministas
            if (
                error instanceof RechazoValidacionPdfError ||
                error instanceof RechazoModeracionPdfError
            ) {
                throw error;
            }

            // Si aún quedan reintentos disponibles, esperar antes de volver a intentar
            if (intento < maxIntentos) {
                await new Promise((resolve) => setTimeout(resolve, delayMs * intento));
            }
        }
    }

    throw new ErrorTecnicoPdfError(
        ultimoError?.message
            ? "El servicio no está disponible en este momento. Intenta nuevamente en unos minutos."
            : undefined
    );
}

/**
 * Inspecciona minuciosamente la estructura y seguridad del PDF a nivel AST.
 * Rechaza JavaScript, enlaces interactivos, acciones de apertura, archivos embebidos,
 * cifrado o anomalías que impidan su inspección segura.
 */
export async function validarEstructuraYSeguridadPdf(buffer: Buffer): Promise<PDFDocument> {
    // 1. Validación de magic bytes (%PDF-)
    if (buffer.length < 5) {
        throw new RechazoValidacionPdfError("El archivo no es un documento PDF válido.");
    }
    const headerChunk = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("binary");
    if (!headerChunk.includes("%PDF-")) {
        throw new RechazoValidacionPdfError("El archivo no contiene la firma de un documento PDF válido.");
    }

    // 2. Carga del documento asegurando que no esté cifrado
    let doc: PDFDocument;
    try {
        doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
    } catch (err: any) {
        const msg = String(err?.message ?? "");
        if (msg.toLowerCase().includes("encrypt") || err?.name === "EncryptedPDFError") {
            throw new RechazoValidacionPdfError("El archivo PDF está protegido o cifrado y no puede ser procesado.");
        }
        throw new RechazoValidacionPdfError("El archivo PDF es inválido o está corrupto.");
    }

    // 3. Cantidad de páginas (máximo 2 páginas)
    const totalPaginas = doc.getPageCount();
    if (totalPaginas < 1) {
        throw new RechazoValidacionPdfError("El archivo PDF no contiene páginas válidas.");
    }
    if (totalPaginas > 2) {
        throw new RechazoValidacionPdfError("El archivo PDF supera el máximo de 2 páginas permitidas.");
    }

    // 4. Definición de elementos de estructura interactivos y potencialmente peligrosos
    const CLAVES_PROHIBIDAS = new Set([
        "JS",
        "JavaScript",
        "Launch",
        "OpenAction",
        "AA",
        "URI",
        "SubmitForm",
        "ImportData",
        "EmbeddedFiles",
        "EF",
        "Filespec",
        "RichMedia",
        "Rendition",
        "Screen",
        "Movie",
        "Sound",
    ]);

    const SUBTIPOS_PROHIBIDOS = new Set([
        "Link",
        "Widget",
        "Screen",
        "Movie",
        "Sound",
        "FileAttachment",
        "RichMedia",
        "3D",
    ]);

    const ACCIONES_PROHIBIDAS = new Set([
        "URI",
        "Launch",
        "JavaScript",
        "GoToR",
        "GoToE",
        "ImportData",
        "SubmitForm",
        "ResetForm",
        "Rendition",
        "Sound",
        "Movie",
    ]);

    // 5. Inspección recursiva de todos los objetos indirectos en el PDF
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
        if (obj instanceof PDFDict) {
            // Revisar claves del diccionario
            for (const [k] of obj.entries()) {
                const keyName = k.asString().replace(/^\//, "");
                if (CLAVES_PROHIBIDAS.has(keyName)) {
                    throw new RechazoValidacionPdfError(
                        `El archivo PDF contiene características interactivas o no permitidas (${keyName}).`
                    );
                }
            }

            // Revisar Subtype en caso de anotaciones
            const subtypeObj = obj.get(PDFName.of("Subtype"));
            if (subtypeObj && typeof (subtypeObj as any).asString === "function") {
                const subtype = (subtypeObj as any).asString().replace(/^\//, "");
                if (SUBTIPOS_PROHIBIDOS.has(subtype)) {
                    throw new RechazoValidacionPdfError(
                        `El archivo PDF contiene anotaciones o elementos interactivos no permitidos (${subtype}).`
                    );
                }
            }

            // Revisar tipo de acción S
            const sObj = obj.get(PDFName.of("S"));
            if (sObj && typeof (sObj as any).asString === "function") {
                const actionType = (sObj as any).asString().replace(/^\//, "");
                if (ACCIONES_PROHIBIDAS.has(actionType)) {
                    throw new RechazoValidacionPdfError(
                        `El archivo PDF contiene acciones o llamadas externas no permitidas (${actionType}).`
                    );
                }
            }

            // Revisar acciones asociadas A o AA
            if (obj.has(PDFName.of("A")) || obj.has(PDFName.of("AA"))) {
                throw new RechazoValidacionPdfError(
                    "El archivo PDF contiene acciones interactivas o automatizadas no permitidas."
                );
            }
        }
    }

    // 6. Revisar Document Catalog
    const catalog = doc.catalog;
    if (
        catalog.has(PDFName.of("OpenAction")) ||
        catalog.has(PDFName.of("AA")) ||
        catalog.has(PDFName.of("AcroForm"))
    ) {
        throw new RechazoValidacionPdfError(
            "El archivo PDF contiene acciones automáticas o formularios interactivos no permitidos."
        );
    }

    const namesObj = catalog.get(PDFName.of("Names"));
    if (namesObj && namesObj instanceof PDFDict) {
        if (namesObj.has(PDFName.of("JavaScript")) || namesObj.has(PDFName.of("EmbeddedFiles"))) {
            throw new RechazoValidacionPdfError(
                "El archivo PDF contiene scripts o archivos embebidos no permitidos."
            );
        }
    }

    // 7. Inspeccionar anotaciones directamente referenciadas en cada página
    for (const page of doc.getPages()) {
        const annots = page.node.Annots();
        if (annots && annots.size() > 0) {
            for (let i = 0; i < annots.size(); i++) {
                const annotRefOrObj = annots.get(i);
                const annot = annotRefOrObj ? doc.context.lookup(annotRefOrObj) : null;
                if (annot && annot instanceof PDFDict) {
                    const subtypeObj = annot.get(PDFName.of("Subtype"));
                    if (subtypeObj && typeof (subtypeObj as any).asString === "function") {
                        const subtype = (subtypeObj as any).asString().replace(/^\//, "");
                        if (SUBTIPOS_PROHIBIDOS.has(subtype)) {
                            throw new RechazoValidacionPdfError(
                                `El archivo PDF contiene anotaciones interactivas (${subtype}) en la página.`
                            );
                        }
                    }
                    if (annot.has(PDFName.of("A")) || annot.has(PDFName.of("AA"))) {
                        throw new RechazoValidacionPdfError(
                            "El archivo PDF contiene acciones asociadas a anotaciones en la página."
                        );
                    }
                }
            }
        }
    }

    return doc;
}

/**
 * Extrae y normaliza el texto disponible en las páginas del PDF.
 * Si el texto normalizado resultante no está vacío, se considera significativo.
 */
export async function extraerYNormalizarTexto(buffer: Buffer): Promise<{
    texto: string;
    tieneTextoSignificativo: boolean;
}> {
    try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const docProxy = await pdfjs.getDocument({
            data: new Uint8Array(buffer),
            useSystemFonts: true,
            disableFontFace: true,
        }).promise;

        let textoCompleto = "";
        for (let i = 1; i <= docProxy.numPages; i++) {
            const page = await docProxy.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => (typeof item?.str === "string" ? item.str : ""))
                .join(" ");
            textoCompleto += pageText + " ";
        }

        // Normalización básica determinista: remueve caracteres de control, unifica espacios
        const textoNormalizado = textoCompleto
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
            .replace(/\s+/g, " ")
            .trim();

        const tieneTextoSignificativo = textoNormalizado.length > 0;
        return { texto: textoNormalizado, tieneTextoSignificativo };
    } catch (err: any) {
        if (err instanceof RechazoValidacionPdfError) throw err;
        throw new RechazoValidacionPdfError("No fue posible procesar el contenido textual del PDF.");
    }
}

/**
 * Renderiza cada página del documento a un buffer PNG para la moderación visual.
 */
export async function renderizarPaginasPdf(buffer: Buffer): Promise<Buffer[]> {
    try {
        const { pdf } = await import("pdf-to-img");
        const docImg = await pdf(buffer, { scale: 1.5 });
        const paginas: Buffer[] = [];
        for await (const pageImg of docImg) {
            paginas.push(Buffer.from(pageImg));
        }
        return paginas;
    } catch (err: any) {
        if (err instanceof RechazoValidacionPdfError) throw err;
        throw new ErrorTecnicoPdfError("Error al renderizar las páginas del documento para moderación visual.");
    }
}

/**
 * Orquestador de la validación y moderación de certificaciones en PDF.
 * Ejecuta validaciones locales e invoca OpenAI y Rekognition concurrentemente.
 */
export async function moderarYValidarPdfCertificacion(buffer: Buffer): Promise<void> {
    // 1. Validación temprana de tamaño estricto (máx 5 MB)
    const TAMANO_MAX_BYTES = 5 * 1024 * 1024;
    if (buffer.length > TAMANO_MAX_BYTES) {
        throw new RechazoValidacionPdfError("El archivo PDF supera el tamaño máximo permitido de 5 MB.");
    }

    // 2. Inspección estructural y de seguridad local
    await validarEstructuraYSeguridadPdf(buffer);

    // 3. Extracción de texto y renderizado de páginas en paralelo (operaciones locales)
    const [{ texto, tieneTextoSignificativo }, paginas] = await Promise.all([
        extraerYNormalizarTexto(buffer),
        renderizarPaginasPdf(buffer),
    ]);

    if (paginas.length === 0) {
        throw new RechazoValidacionPdfError("El archivo PDF no contiene páginas visualizables.");
    }

    try {
        // 4. Construcción y ejecución en paralelo de todas las tareas de moderación externa
        const tareasModeracion: Promise<void>[] = [];

        // Tarea de moderación de texto (OpenAI) si hay contenido significativo
        if (tieneTextoSignificativo) {
            tareasModeracion.push(
                (async () => {
                    const resultadoTexto = await ejecutarConReintentos(() => analizarTexto(texto));
                    if (resultadoTexto.flagged) {
                        throw new RechazoModeracionPdfError(
                            "El contenido textual de la certificación fue rechazado por las políticas de moderación."
                        );
                    }
                })()
            );
        }

        // Tareas de moderación visual por cada página (AWS Rekognition)
        for (let i = 0; i < paginas.length; i++) {
            const pageBuffer = paginas[i];
            const numeroPagina = i + 1;
            tareasModeracion.push(
                (async () => {
                    const resultadoImagen = await ejecutarConReintentos(() => analizarImagen(pageBuffer));
                    if (resultadoImagen.flagged) {
                        throw new RechazoModeracionPdfError(
                            `La página ${numeroPagina} del documento no cumple con las normas visuales de moderación.`
                        );
                    }
                })()
            );
        }

        // Ejecutar todas las llamadas de moderación concurrentemente
        await Promise.all(tareasModeracion);
    } finally {
        // Garantizar limpieza de referencias en memoria
        paginas.length = 0;
    }
}
