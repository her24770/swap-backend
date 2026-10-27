import { z } from "zod";
import { arrayAcotado } from "./arrayAcotado";
import { errorFormato, errorRequerido } from "./erroresZod";

const arrayMultipart = <T extends z.ZodTypeAny>(item: T, max: number, mensaje: string) => z.preprocess(
    (value) => typeof value === "string" ? JSON.parse(value) : value,
    arrayAcotado(item, max, mensaje).optional()
);

/**
 * Schema para POST /api/publicaciones
 * Basado en el modelo Publicacion del schema.prisma
 */
export const schemaCrearPublicacion = z.object({
    titulo: z
        .string(errorRequerido("El título es obligatorio."))
        .min(3, "El título debe tener al menos 3 caracteres.")
        .max(100, "El título no puede superar 100 caracteres."),

    descripcion: z
        .string(errorRequerido("La descripción es obligatoria."))
        .min(10, "La descripción debe tener al menos 10 caracteres.")
        .max(255, "La descripción no puede superar 255 caracteres."),

    precio: z
        .coerce.number({ error: "El precio debe ser un número." })
        .min(0, "El precio no puede ser negativo.")
        .default(0),

    tipo_publicacion: z
        .enum(
            ["material", "tutoria", "negocio"] as const,
            errorRequerido(
                "El tipo de publicación es obligatorio.",
                "El tipo debe ser 'material', 'tutoria' o 'negocio'."
            )
        ),

    estado: z
        .enum(["disponible", "vendido", "reservado", "activo", "inactivo"], {
            error: "Estado inválido.",
        })
        .optional(),

    destacar: z
        .preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean({
            error: "El campo destacar debe ser un booleano."
        }))
        .optional()
        .default(false),

    imagenes: arrayAcotado(
            z.url(errorFormato("Cada imagen debe ser una URL válida.")),
            20,
            "No se pueden enviar más de 20 imágenes."
        )
        .optional()
        .default([]),

    etiquetas: arrayMultipart(z.coerce.number().int().positive("Cada etiqueta debe ser un ID válido."), 50, "No se pueden enviar más de 50 etiquetas.").default([]),
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
        .coerce.number({ error: "El precio debe ser un número." })
        .min(0, "El precio no puede ser negativo.")
        .max(999.99, "El precio no puede superar Q999.99.")
        .optional(),

    estado: z
        .enum(["disponible", "vendido", "reservado", "activo", "inactivo"], {
            error: "Estado inválido para publicación.",
        })
        .optional(),

    tipo_publicacion: z
        .enum(["material", "tutoria", "negocio"] as const, {
            error: "Tipo de publicación inválido.",
        })
        .optional(),

    etiquetas: arrayMultipart(z.coerce.number().int().positive("Cada etiqueta debe ser un ID válido."), 50, "No se pueden enviar más de 50 etiquetas."),
    imagenesEliminar: arrayMultipart(z.url(errorFormato("Cada imagen debe ser una URL válida.")), 20, "No se pueden eliminar más de 20 imágenes."),
});

export const schemaGuardarPublicacion = z.object({
    publicacionId: z
        .number(errorRequerido("El ID de la publicación es obligatorio.", "El ID debe ser un número."))
        .int()
        .positive("El ID debe ser un número positivo.")
});

export const schemaDestacarPublicacion = z.object({
    destacar: z.boolean(errorRequerido(
        "El campo destacar es obligatorio.",
        "El campo destacar debe ser un booleano."
    ))
});


export const paginationOptions = z.object({
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().positive().max(100, "El límite no puede superar 100.").optional().default(10),
    sort: z.enum(["fecha", "me_gusta", "precio"]).optional().default("fecha"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
    tipo: z.string().optional(),
    estado: z.string().optional(),
});

export const schemaFiltrosPublicacion = paginationOptions.extend({
    sort: z.enum(["fecha", "calificacion", "precio", "me_gusta"]).optional().default("fecha"),
    precio_min: z
        .number({ error: "El precio mínimo debe ser un número." })
        .min(0, "El precio mínimo no puede ser negativo.")
        .default(0)
        .optional(),
    precio_max: z
        .number({ error: "El precio máximo debe ser un número." })
        .min(0, "El precio máximo no puede ser negativo.")
        .default(999.99)
        .optional(),
    calificacion_min: z
        .number({ error: "La calificación mínima debe ser un número." })
        .min(0, "La calificación mínima no puede ser negativa.")
        .max(5, "La calificación máxima no puede superar 5.")
        .default(0)
        .optional(),
    calificacion_max: z
        .number({ error: "La calificación máxima debe ser un número." })
        .min(0, "La calificación máxima no puede ser negativa.")
        .max(5, "La calificación máxima no puede superar 5.")
        .default(5)
        .optional(),
    etiquetas: arrayAcotado(z.number().int().positive("Cada etiqueta debe ser un ID válido."), 50, "No se pueden enviar más de 50 etiquetas.")
        .optional(),
});

export type CrearPublicacionInput = z.infer<typeof schemaCrearPublicacion>;
export type EditarPublicacionInput = z.infer<typeof schemaEditarPublicacion>;
export type GuardarPublicacionInput = z.infer<typeof schemaGuardarPublicacion>;
export type DestacarPublicacionInput = z.infer<typeof schemaDestacarPublicacion>;
export type PaginationOptionInput = z.infer<typeof paginationOptions>;
export type FiltrosPublicacionInput = z.infer<typeof schemaFiltrosPublicacion>;
