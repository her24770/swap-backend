import { z } from "zod";

/**
 * Schema para GET /api/moderador/usuarios (query params).
 * Se valida manualmente contra req.query, igual que
 * schemaFiltrosModeracionPublicacion (el middleware `validar` solo trabaja
 * sobre req.body).
 */
export const schemaFiltrosModeracionUsuario = z.object({
    q: z.string().trim().optional(),
    sort: z.enum(["nombre", "calificacion", "reportes_recibidos", "total_resenas"]).optional().default("nombre"),
    order: z.enum(["asc", "desc"]).optional().default("asc"),
    conReportes: z.coerce.boolean().optional().default(false),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50, "El límite no puede superar 50.").optional().default(12),
});

export type FiltrosModeracionUsuarioInput = z.infer<typeof schemaFiltrosModeracionUsuario>;