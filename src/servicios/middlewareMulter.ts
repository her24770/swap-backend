import multer from "multer";

const TAMANO_MAX = 5 * 1024 * 1024; // 5 MB
const TAMANO_MAX_PDF = 10 * 1024 * 1024; // 10 MB

const firmas: Record<string, (buffer: Buffer) => boolean> = {
    "image/jpeg": buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    "image/png": buffer => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/webp": buffer => buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP",
    "application/pdf": buffer => buffer.subarray(0, 5).toString() === "%PDF-",
};

export class TipoArchivoError extends Error {}

export function contenidoCoincideConMime(buffer: Buffer, mimetype: string): boolean {
    return firmas[mimetype]?.(buffer) ?? false;
}

function crearUpload(tipos: string[], limite: number, maxArchivos: number, mensaje: string): multer.Multer {
    const storage: multer.StorageEngine = {
        _handleFile: (_req, file, callback) => {
            const chunks: Buffer[] = [];
            file.stream.on("data", chunk => chunks.push(chunk));
            file.stream.on("end", () => {
                const buffer = Buffer.concat(chunks);
                if (!contenidoCoincideConMime(buffer, file.mimetype)) {
                    callback(new TipoArchivoError(mensaje));
                    return;
                }
                callback(null, { buffer, size: buffer.length });
            });
        },
        _removeFile: (_req, file, callback) => {
            file.buffer = Buffer.alloc(0);
            callback(null);
        },
    };

    return multer({
        storage,
        limits: { fileSize: limite, files: maxArchivos },
        fileFilter: (_req, file, callback) => {
            tipos.includes(file.mimetype)
                ? callback(null, true)
                : callback(new TipoArchivoError(mensaje));
        },
    });
}

export const uploadImagen = crearUpload(
    ["image/jpeg", "image/png", "image/webp"],
    TAMANO_MAX,
    5,
    "Tipo de archivo no permitido. Solo JPG, PNG o WEBP.",
);

export const uploadPdf = crearUpload(
    ["application/pdf"],
    TAMANO_MAX_PDF,
    1,
    "Tipo de archivo no permitido. Solo PDF.",
);
