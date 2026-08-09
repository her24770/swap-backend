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
