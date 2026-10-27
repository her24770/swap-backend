import { z } from "zod";
import { arrayAcotado } from "./arrayAcotado";

/**
 * Schema para POST /etiqueta/user/:id
 * Sincroniza las etiquetas de un usuario
 */
export const schemaSincronizarEtiquetas = z.object({
    ids: arrayAcotado(
            z.number({
                required_error: "Cada ID de etiqueta debe ser un número.",
                invalid_type_error: "Cada ID de etiqueta debe ser un número."
            })
            .int("El ID de etiqueta debe ser un número entero.")
            .positive("El ID de etiqueta debe ser un número positivo."),
            50,
            "No se pueden enviar más de 50 etiquetas.",
            (array) => array.min(1, "Debe proporcionar al menos una etiqueta.")
        )
});

export type SincronizarEtiquetasInput = z.infer<typeof schemaSincronizarEtiquetas>;