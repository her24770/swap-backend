import { z } from "zod";

export const schemaCrearCalificacion = z.object({
    id_usuario_calificado: z
        .number({
        required_error: "El ID del usuario a calificar es obligatorio.",
        invalid_type_error: "El ID del usuario calificado debe ser un número entero.",
        })
        .int()
        .positive(),
        
    id_usuario_calificador: z
        .number({
        required_error: "El ID del calificador es obligatorio.",
        invalid_type_error: "El ID del calificador debe ser un número entero.",
        })
        .int()
        .positive(),

    calificacion: z
        .number({
        required_error: "La puntuación es obligatoria.",
        invalid_type_error: "La calificación debe ser un número entero entre 1 y 5.",
        })
        .int("La calificación no puede tener decimales (deben ser estrellas completas).")
        .min(1, "La calificación mínima es 1 estrella.")
        .max(5, "La calificación máxima es 5 estrellas."),
}).refine((data) => data.id_usuario_calificador !== data.id_usuario_calificado, {
    message: "No puedes calificarte a ti mismo en la plataforma.",
    path: ["id_usuario_calificado"], 
});


export const schemaEditarCalificacion = z.object({
    calificacion: z
        .number({
        required_error: "La puntuación es obligatoria.",
        invalid_type_error: "La calificación debe ser un número entero entre 1 y 5.",
        })
        .int("La calificación no puede tener decimales (deben ser estrellas completas).")
        .min(1, "La calificación mínima es 1 estrella.")
        .max(5, "La calificación máxima es 5 estrellas."),
});

export type EditarCalificacionInput = z.infer<typeof schemaEditarCalificacion>; 

export type CrearCalificacionInput = z.infer<typeof schemaCrearCalificacion>;