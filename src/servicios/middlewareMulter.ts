import multer from "multer";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAX = 5 * 1024 * 1024; // 5 MB

export const uploadImagen = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: TAMANO_MAX },
    fileFilter: (_req, file, cb) => {
        if (TIPOS_PERMITIDOS.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Tipo de archivo no permitido. Solo JPG, PNG o WEBP."));
        }
    },
});
