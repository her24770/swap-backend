import { z } from "zod";

/**
 * Schema para validar el parámetro :id en rutas de notificación.
 */
export const schemaParamIdNotificacion = z.object({
    id: z.coerce
        .number({ invalid_type_error: "El ID de la notificación debe ser un número." })
        .int("El ID de la notificación debe ser un número entero.")
        .positive("El ID de la notificación debe ser un número entero positivo."),
});

/**
 * Schema para validar el body en PATCH /api/notificacion/:id/estado
 */
export const schemaCambiarEstadoNotificacion = z.object({
    estado: z.enum(["leido", "enviado"], {
        errorMap: () => ({ message: "Estado inválido. Use 'leido' o 'enviado'." }),
    }),
});

export type ParamIdNotificacion = z.infer<typeof schemaParamIdNotificacion>;
export type CambiarEstadoNotificacionInput = z.infer<typeof schemaCambiarEstadoNotificacion>;
