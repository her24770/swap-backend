import { z } from "zod";

/**
 * Schema para PUT /api/usuarios/perfil
 * Todos los campos son opcionales — solo se actualiza lo que se envía.
 */
export const schemaActualizarPerfil = z.object({
    nombre: z
        .string()
        .min(2, "El nombre debe tener al menos 2 caracteres.")
        .max(100, "El nombre no puede superar 100 caracteres.")
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
 * Schema para POST /api/usuarios/perfil/contacto
 */
export const schemaAgregarContacto = z.object({
    tipo_contacto: z
        .number({ required_error: "El tipo de contacto es obligatorio.", invalid_type_error: "El tipo de contacto debe ser un número." })
        .int()
        .positive("El tipo de contacto debe ser un ID válido."),

    valor: z
        .string({ required_error: "El valor del contacto es obligatorio." })
        .min(1, "El valor no puede estar vacío.")
        .max(255, "El valor no puede superar 255 caracteres."),
});

export type ActualizarPerfilInput = z.infer<typeof schemaActualizarPerfil>;
export type AgregarContactoInput = z.infer<typeof schemaAgregarContacto>;