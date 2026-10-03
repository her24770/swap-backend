import { z } from "zod";

export const schemaCrearResena = z.object({
  id_receptor: z.number().int().positive("El ID del receptor es requerido."),
  tipo_resena: z.string({ required_error: "El tipo de reseña es obligatorio." })
                .min(3, "El tipo de reseña debe tener al menos 3 caracteres.")
                .max(25, "El tipo de reseña no puede superar los 25 caracteres."),
  calificacion: z
    .number()
    .int()
    .min(1, "La calificación mínima es 1 estrella.")
    .max(5, "La calificación máxima es 5 estrellas."),
  contenido: z
    .string({ required_error: "El texto de la reseña es obligatorio." })
    .min(10, "La reseña debe tener al menos 10 caracteres.")
    .max(500, "La reseña no puede superar los 500 caracteres."),
});

export const schemaEditarResena = z.object({
    calificacion: z
        .number()
        .int()
        .min(1, "La calificación mínima es 1 estrella.")
        .max(5, "La calificación máxima es 5 estrellas."),
    contenido: z
        .string()
        .min(10, "La reseña debe tener al menos 10 caracteres.")
        .max(500, "La reseña no puede superar los 500 caracteres."),
});

export type CrearResenaInput = z.infer<typeof schemaCrearResena>;
export type EditarResenaInput = z.infer<typeof schemaEditarResena>;