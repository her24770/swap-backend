import { z } from "zod";


export const schemaCrearAnuncio = z.object({

    titulo: z
        .string({ required_error: "El título es obligatorio." })
        .min(5, "El título debe tener al menos 5 caracteres.")
        .max(100, "El título no puede superar 100 caracteres."),

    descripcion: z
        .string({ required_error: "La descripción es obligatoria." })
        .min(10, "La descripción debe tener al menos 10 caracteres.")
        .max(1000, "La descripción no puede superar 1000 caracteres."),

});


export const schemaEditarAnuncio = z.object({
    titulo: z
        .string({ required_error: "El título es obligatorio." })
        .min(5, "El título debe tener al menos 5 caracteres.")
        .max(100, "El título no puede superar 100 caracteres.")
        .optional(),

    descripcion: z
        .string({ required_error: "La descripción es obligatoria." })
        .min(10, "La descripción debe tener al menos 10 caracteres.")
        .max(1000, "La descripción no puede superar 1000 caracteres.")
        .optional(),
});

export type CrearAnuncioInput = z.infer<typeof schemaCrearAnuncio>;
export type EditarAnuncioInput = z.infer<typeof schemaEditarAnuncio>;