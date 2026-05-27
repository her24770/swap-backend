import { z } from "zod";
import { paginationOptions } from "./schemaPublicacion";

/**
 * Schema para PUT /api/user/:id
 * Todos los campos son opcionales — solo se actualiza lo que se envía.
 */
export const schemaActualizarPerfil = z.object({
    nombre: z
        .string()
        .min(2, "El nombre debe tener al menos 2 caracteres.")
        .max(100, "El nombre no puede superar 100 caracteres.")
        .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
            "El nombre solo puede contener letras y espacios.")
        .optional(),

    url_foto_perfil: z
        .string()
        .url("La URL de la foto no tiene un formato válido.")
        .optional(),

    descripcion: z
        .string()
        .max(500, "La descripción no puede superar 500 caracteres.")
        .optional()
        .nullable(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Debe enviar al menos un campo para actualizar." }
);

/**
 * Schema para PUT /api/user/:id/contactos
 */
const contactoSchema = z.object({
    tipo_contacto: z
        .number({ required_error: "El tipo de contacto es obligatorio.", invalid_type_error: "El tipo de contacto debe ser un número." })
        .int()
        .positive("El tipo de contacto debe ser un ID válido."),

    valor: z
        .string({ required_error: "El valor del contacto es obligatorio." })
        .min(1, "El valor no puede estar vacío.")
        .max(255, "El valor no puede superar 255 caracteres."),
});

export const schemaAgregarContactos = z.object({
    contactos: z.union([
        contactoSchema,
        z.array(contactoSchema)
    ], {
        required_error: "Debe enviar al menos un contacto.",
        invalid_type_error: "Debe enviar un contacto o un array de contactos."
    }).refine(
        (data) => {
            if (Array.isArray(data) && data.length === 0) {
                return false;
            }
            return true;
        },
        { message: "Debe enviar al menos un contacto." }
    )
});



// Filtros para búsqueda de tutores
export const schemaFiltrosTutor = paginationOptions.extend({

    precio_min: z
        .number({
            invalid_type_error:
                "El precio mínimo debe ser un número."
        })
        .min(0, "El precio mínimo no puede ser negativo.")
        .default(0)
        .optional(),

    precio_max: z
        .number({
            invalid_type_error:
                "El precio máximo debe ser un número."
        })
        .min(0, "El precio máximo no puede ser negativo.")
        .default(999.99)
        .optional(),

    calificacion_min: z
        .number({
            invalid_type_error:
                "La calificación mínima debe ser un número."
        })
        .min(0, "La calificación mínima no puede ser negativa.")
        .max(5, "La calificación máxima no puede superar 5.")
        .default(0)
        .optional(),

    calificacion_max: z
        .number({
            invalid_type_error:
                "La calificación máxima debe ser un número."
        })
        .min(0, "La calificación máxima no puede ser negativa.")
        .max(5, "La calificación máxima no puede superar 5.")
        .default(5)
        .optional(),

    etiquetas: z
        .array(
            z.number()
                .int()
                .positive(
                    "Cada etiqueta debe ser un ID válido."
                )
        )
        .optional(),

    dias: z
        .array(
            z.enum([
                "lunes",
                "martes",
                "miercoles",
                "jueves",
                "viernes",
                "sabado",
                "domingo"
            ])
        )
        .optional(),

    hora_inicio: z
        .string()
        .regex(
            /^([01]\d|2[0-3]):([0-5]\d)$/,
            "La hora de inicio debe tener formato HH:mm"
        )
        .optional(),

    hora_final: z
        .string()
        .regex(
            /^([01]\d|2[0-3]):([0-5]\d)$/,
            "La hora final debe tener formato HH:mm"
        )
        .optional(),
});

export type ActualizarPerfilInput = z.infer<typeof schemaActualizarPerfil>;
export type AgregarContactoInput = z.infer<typeof schemaAgregarContactos>;
export type FiltrosTutorInput = z.infer<typeof schemaFiltrosTutor>;
