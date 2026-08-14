import { z } from "zod";

/**
 * Schema para POST /api/moderador/login
 */
export const schemaLoginModerador = z.object({
    usuario: z
        .string({ required_error: "El usuario es obligatorio." })
        .min(1, "El usuario no puede estar vacío."),

    password: z
        .string({ required_error: "La contraseña es obligatoria." })
        .min(1, "La contraseña no puede estar vacía."),
});

export type LoginModeradorInput = z.infer<typeof schemaLoginModerador>;

/**
 * Schema para POST /api/moderador (crear moderador)
 * Mismas reglas de password que schemaRegistro (schemaAuth.ts), para
 * mantener la misma fortaleza exigida al crear cualquier cuenta.
 */
export const schemaCrearModerador = z.object({
    usuario: z
        .string({ required_error: "El usuario es obligatorio." })
        .min(3, "El usuario debe tener al menos 3 caracteres.")
        .max(100, "El usuario no puede superar 100 caracteres."),

    password: z
        .string({ required_error: "La contraseña es obligatoria." })
        .min(8, "La contraseña debe tener al menos 8 caracteres.")
        .regex(/[A-Z]/, "La contraseña debe contener al menos una letra mayúscula.")
        .regex(/[0-9]/, "La contraseña debe contener al menos un número."),

    nivel: z.enum(["moderador", "superadmin"], {
        required_error: "El nivel es obligatorio.",
        invalid_type_error: "El nivel debe ser 'moderador' o 'superadmin'.",
    }),
});

export type CrearModeradorInput = z.infer<typeof schemaCrearModerador>;

/**
 * Schema para PATCH /api/moderador/:id (editar moderador)
 * Al menos uno de los dos campos debe venir en el body.
 */
export const schemaEditarModerador = z.object({
    nivel: z.enum(["moderador", "superadmin"], {
        invalid_type_error: "El nivel debe ser 'moderador' o 'superadmin'.",
    }).optional(),

    password: z
        .string()
        .min(8, "La contraseña debe tener al menos 8 caracteres.")
        .regex(/[A-Z]/, "La contraseña debe contener al menos una letra mayúscula.")
        .regex(/[0-9]/, "La contraseña debe contener al menos un número.")
        .optional(),
}).refine((data) => data.nivel !== undefined || data.password !== undefined, {
    message: "Debe enviar al menos 'nivel' o 'password' para actualizar.",
});

export type EditarModeradorInput = z.infer<typeof schemaEditarModerador>;
