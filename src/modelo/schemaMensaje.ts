import { z } from "zod";

/**
 * Schema para POST /api/mensajes
 * Basado en el modelo Mensaje del schema.prisma
 */
export const schemaEnviarMensaje = z.object({
    id_conversacion: z
        .number({ required_error: "El ID de conversación es obligatorio.", invalid_type_error: "El ID de conversación debe ser un número." })
        .int()
        .positive("El ID de conversación debe ser un ID válido."),

    mensaje: z
        .string({ required_error: "El mensaje es obligatorio." })
        .min(1, "El mensaje no puede estar vacío.")
        .max(2000, "El mensaje no puede superar 2000 caracteres."),
});

/**
 * Schema para POST /api/conversaciones
 * Inicia una nueva conversación con otro usuario.
 */
export const schemaCrearConversacion = z.object({
    id_usuario_2: z
        .number({ required_error: "El ID del destinatario es obligatorio.", invalid_type_error: "El ID del destinatario debe ser un número." })
        .int()
        .positive("El ID del destinatario debe ser un ID válido."),
});

export type EnviarMensajeInput = z.infer<typeof schemaEnviarMensaje>;
export type CrearConversacionInput = z.infer<typeof schemaCrearConversacion>;