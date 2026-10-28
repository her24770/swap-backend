import { z } from "zod";
import { errorRequerido } from "./erroresZod.js";

export const schemaCrearCertificacion = z.object({
    nombre: z
        .string(errorRequerido("El nombre de la certificación es obligatorio."))
        .min(3, "El nombre debe tener al menos 3 caracteres.")
        .max(100, "El nombre no puede superar 100 caracteres."),

    lugar_emision: z
        .string(errorRequerido("El lugar de emisión es obligatorio."))
        .min(3, "El lugar de emisión debe tener al menos 3 caracteres.")
        .max(100, "El lugar de emisión no puede superar 100 caracteres."),

    id_etiqueta: z
        .coerce.number(errorRequerido("La etiqueta es obligatoria.", "El ID de etiqueta debe ser un número."))
        .int("El ID de etiqueta debe ser un entero.")
        .positive("El ID de etiqueta debe ser un número positivo."),
});

export type CrearCertificacionInput = z.infer<typeof schemaCrearCertificacion>;
