import { z } from "zod";
import { arrayAcotado } from "./arrayAcotado";
import { errorRequerido, errorRequeridoFormato } from "./erroresZod";

/**
 * Schema para POST /api/auth/registro
 * Basado en el modelo Usuario del schema.prisma
 */
export const schemaRegistro = z.object({
    nombre: z
        .string(errorRequerido("El nombre es obligatorio."))
        .min(2, "El nombre debe tener al menos 2 caracteres.")
        .max(100, "El nombre no puede superar 100 caracteres.")
        .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, "El nombre solo puede contener letras y espacios."),

    carnet: z
        .number(errorRequerido("El carnet es obligatorio.", "El carnet es un número."))
        .int("El carnet debe ser un número entero.")
        .positive("El carnet debe ser un número positivo.")
        .refine(
            (value: number) => value >= 10000 && value <= 99999999,
            "El carnet debe tener entre 5 y 8 dígitos."
        ),

    email_institucional: z
        .email(errorRequeridoFormato("El correo institucional es obligatorio.", "El correo no tiene un formato válido."))
        .endsWith("@uvg.edu.gt", "El correo debe ser institucional (@uvg.edu.gt)."),

    password: z
        .string(errorRequerido("La contraseña es obligatoria."))
        .min(8, "La contraseña debe tener al menos 8 caracteres.")
        .regex(/[A-Z]/, "La contraseña debe contener al menos una letra mayúscula.")
        .regex(/[0-9]/, "La contraseña debe contener al menos un número."),

    descripcion: z
        .string()
        .max(500, "La descripción no puede superar 500 caracteres.")
        .optional()
        .nullable(),

    etiquetas: arrayAcotado(
            z.number({ error: "Cada ID de etiqueta debe ser un número." })
                .int("El ID de etiqueta debe ser entero.")
                .positive("El ID de etiqueta debe ser positivo."),
            10,
            "No puedes seleccionar más de 10 categorías.",
            (array) => array.min(1, "Debes seleccionar al menos una categoría.")
        )
        .optional(),

    codigo_verificacion: z
        .string(errorRequerido("El código de verificación es obligatorio."))
        .regex(/^\d{6}$/, "El código de verificación debe tener 6 dígitos."),
});

/**
 * Schema para POST /api/auth/login
 */
export const schemaLogin = z.object({
    email_institucional: z
        .email(errorRequeridoFormato("El correo institucional es obligatorio.", "El correo no tiene un formato válido.")),

    password: z
        .string(errorRequerido("La contraseña es obligatoria."))
        .min(1, "La contraseña no puede estar vacía."),
});

export const schemaSolicitarCodigoRegistro = z.object({
    email_institucional: z
        .email(errorRequeridoFormato("El correo institucional es obligatorio.", "El correo no tiene un formato válido."))
        .endsWith("@uvg.edu.gt", "El correo debe ser institucional (@uvg.edu.gt)."),

    carnet: z
        .number(errorRequerido("El carnet es obligatorio.", "El carnet es un número."))
        .int("El carnet debe ser un número entero.")
        .positive("El carnet debe ser un número positivo.")
        .refine(
            (value: number) => value >= 10000 && value <= 99999999,
            "El carnet debe tener entre 5 y 8 dígitos."
        ),
});

export const schemaForgotPassword = z.object({
    email: z
        .email(errorRequeridoFormato("El correo institucional es obligatorio.", "El correo no tiene un formato válido.")),
});

export const schemaVerifyResetCode = z.object({
    email: z
        .email(errorRequeridoFormato("El correo institucional es obligatorio.", "El correo no tiene un formato válido.")),

    code: z
        .string(errorRequerido("El código es obligatorio."))
        .regex(/^\d{6}$/, "El código debe tener 6 dígitos."),
});

export const schemaResetPassword = z.object({
    email: z
        .email(errorRequeridoFormato("El correo institucional es obligatorio.", "El correo no tiene un formato válido.")),

    code: z
        .string(errorRequerido("El código es obligatorio."))
        .regex(/^\d{6}$/, "El código debe tener 6 dígitos."),

    newPassword: z
        .string(errorRequerido("La contraseña es obligatoria."))
        .min(8, "La contraseña debe tener al menos 8 caracteres.")
        .regex(/[A-Z]/, "La contraseña debe contener al menos una letra mayúscula.")
        .regex(/[0-9]/, "La contraseña debe contener al menos un número."),
});

export type RegistroInput = z.infer<typeof schemaRegistro>;
export type LoginInput = z.infer<typeof schemaLogin>;
