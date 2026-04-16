import { z } from "zod";

/**
 * Schema para POST /api/auth/registro
 * Basado en el modelo Usuario del schema.prisma
 */
export const schemaRegistro = z.object({
    nombre: z
        .string({ required_error: "El nombre es obligatorio." })
        .min(2, "El nombre debe tener al menos 2 caracteres.")
        .max(100, "El nombre no puede superar 100 caracteres.")
        .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, "El nombre solo puede contener letras y espacios."),

    carnet: z
        .number({ required_error: "El carnet es obligatorio.", invalid_type_error: "El carnet es un número." })
        .int("El carnet debe ser un número entero.")
        .positive("El carnet debe ser un número positivo.")
        .refine(
            (value: number) => value >= 10000 && value <= 99999999,
            "El carnet debe tener entre 5 y 8 dígitos."
        ),

    email_institucional: z
        .string({ required_error: "El correo institucional es obligatorio." })
        .email("El correo no tiene un formato válido.")
        .endsWith("@uvg.edu.gt", "El correo debe ser institucional (@uvg.edu.gt)."),

    password: z
        .string({ required_error: "La contraseña es obligatoria." })
        .min(8, "La contraseña debe tener al menos 8 caracteres.")
        .regex(/[A-Z]/, "La contraseña debe contener al menos una letra mayúscula.")
        .regex(/[0-9]/, "La contraseña debe contener al menos un número."),

    url_foto_perfil: z
        .string()
        .url("La URL de la foto no tiene un formato válido.")
        .optional()
        .default(""),

    descripcion: z
        .string()
        .max(500, "La descripción no puede superar 500 caracteres.")
        .optional()
        .nullable(),
});

/**
 * Schema para POST /api/auth/login
 */
export const schemaLogin = z.object({
    email_institucional: z
        .string({ required_error: "El correo institucional es obligatorio." })
        .email("El correo no tiene un formato válido."),

    password: z
        .string({ required_error: "La contraseña es obligatoria." })
        .min(1, "La contraseña no puede estar vacía."),
});

export type RegistroInput = z.infer<typeof schemaRegistro>;
export type LoginInput = z.infer<typeof schemaLogin>;