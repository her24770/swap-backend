import { z } from "zod";

/**
 * Schema para POST /etiqueta/user/:id
 * Sincroniza las etiquetas de un usuario
 */
export const schemaSincronizarEtiquetas = z.object({
    ids: z
        .array(
            z.number({
                required_error: "Cada ID de etiqueta debe ser un número.",
                invalid_type_error: "Cada ID de etiqueta debe ser un número."
            })
            .int("El ID de etiqueta debe ser un número entero.")
            .positive("El ID de etiqueta debe ser un número positivo.")
        )
        .min(1, "Debe proporcionar al menos una etiqueta.")
});

export type SincronizarEtiquetasInput = z.infer<typeof schemaSincronizarEtiquetas>;