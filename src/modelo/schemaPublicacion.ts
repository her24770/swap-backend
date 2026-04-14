import { z } from "zod";

/**
 * Schema para POST /api/publicaciones
 * Basado en el modelo Publicacion del schema.prisma
 */
export const schemaCrearPublicacion = z.object({
    titulo: z
        .string({ required_error: "El título es obligatorio." })
        .min(3, "El título debe tener al menos 3 caracteres.")
        .max(100, "El título no puede superar 100 caracteres."),

    descripcion: z
        .string({ required_error: "La descripción es obligatoria." })
        .min(10, "La descripción debe tener al menos 10 caracteres.")
        .max(255, "La descripción no puede superar 255 caracteres."),

    precio: z
        .number({ invalid_type_error: "El precio debe ser un número." })
        .min(0, "El precio no puede ser negativo.")
        .default(0),

    tipo_publicacion: z
        .number({ required_error: "El tipo de publicación es obligatorio.", invalid_type_error: "El tipo de publicación debe ser un número." })
        .int()
        .positive("El tipo de publicación debe ser un ID válido."),

    estado: z
        .number({ invalid_type_error: "El estado debe ser un número." })
        .int()
        .positive()
        .optional(),

    imagenes: z
        .array(
            z.string().url("Cada imagen debe ser una URL válida.")
        )
        .optional()
        .default([]),

    etiquetas: z
        .array(
            z.number().int().positive("Cada etiqueta debe ser un ID válido.")
        )
        .optional()
        .default([]),
});

/**
 * Schema para PUT /api/publicaciones/:id
 * Todos los campos son opcionales — solo se actualiza lo que se envía.
 */
export const schemaEditarPublicacion = z.object({
    titulo: z
        .string()
        .min(3, "El título debe tener al menos 3 caracteres.")
        .max(100, "El título no puede superar 100 caracteres.")
        .optional(),

    descripcion: z
        .string()
        .min(10, "La descripción debe tener al menos 10 caracteres.")
        .max(255, "La descripción no puede superar 255 caracteres.")
        .optional(),

    precio: z
        .number({ invalid_type_error: "El precio debe ser un número." })
        .min(0, "El precio no puede ser negativo.")
        .optional(),

    estado: z
        .number({ invalid_type_error: "El estado debe ser un número." })
        .int()
        .positive()
        .optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Debe enviar al menos un campo para actualizar." }
);

export type CrearPublicacionInput = z.infer<typeof schemaCrearPublicacion>;
export type EditarPublicacionInput = z.infer<typeof schemaEditarPublicacion>;