import { z } from "zod";

export const tiposObjetivoReporte = ["usuario", "publicacion", "comentario"] as const;

export const motivosReporte = [
    "No cumplió con fechas",
    "Información falsa",
    "Incumple las normas",
    "Cuenta falsa o suplantación de identidad",
    "Publica contenido inapropiado",
    "Acoso, amenazas o bullying",
    "Spam o estafa",
    "Es ofensivo, insultante o usa lenguaje vulgar",
    "Es spam, publicidad no deseada o enlace sospechoso",
    "Acoso dirigido a otro usuario en la conversación",
    "Revela información personal privada",
    "Venta o promoción de objetos inapropiados",
    "Discurso de odio o símbolos ofensivos",
    "Violencia, daño o actividades peligrosas",
    "Desnudez o contenido sexual explícito",
    "Propiedad intelectual o derechos de autor",
] as const;

/**
 * Schema para POST /api/reportes
 * Basado en el modelo Reporte del schema.prisma
 */
export const schemaCrearReporte = z.object({
    tipo_objetivo: z.enum(tiposObjetivoReporte, {
        required_error: "El tipo de objetivo es obligatorio.",
        invalid_type_error: "El tipo de objetivo no es válido.",
    }),

    id_objetivo: z
        .number({ required_error: "El ID del objetivo es obligatorio.", invalid_type_error: "El ID del objetivo debe ser un número." })
        .int()
        .positive("El ID del objetivo debe ser un ID válido."),

    motivo: z.enum(motivosReporte, {
        required_error: "El motivo del reporte es obligatorio.",
        invalid_type_error: "El motivo del reporte no es válido.",
    }),

    detalle: z
        .string()
        .trim()
        .max(500, "El detalle no puede superar 500 caracteres.")
        .optional()
        .default(""),
});

/**
 * ===========================================
 * Schema para request de la paginación de reportes y tipos para formato de respuesta
 * ===========================================
 */
export const reportePaginationOptions = z.object({
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().positive().optional().default(10),
    sort: z.enum(["fecha", "estado"]).optional().default("fecha"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
    estado: z.string().optional(),
    motivo: z.string().optional(),
    tipo: z.enum(["publicacion", "mensaje", "todos"]).optional().default("todos"),
    idReceptor: z.number().optional(),
    idEmisor: z.number().optional(),
});

export type ReporteTableData = {
    id_reporte: number;
    tipo: 'Publicación' | 'Mensaje';
    fecha: Date;
    estado: string;
    emisor: {
        nombre: string;
        email_institucional: string;
        url_foto_perfil: string;
    };
    receptor: {
        nombre: string;
        email_institucional: string;
        url_foto_perfil: string;
    };
};

export interface ResultadoBusquedaReporte {
    reportes: ReporteTableData[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
/**
 * ===========================================
 */

export type ReportePaginationOptions = z.infer<typeof reportePaginationOptions>;
export type CrearReporteInput = z.infer<typeof schemaCrearReporte>;
export type TipoObjetivoReporte = typeof tiposObjetivoReporte[number];
export type MotivoReporteInput = typeof motivosReporte[number];
