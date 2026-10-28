import { z } from "zod";
import { errorRequerido } from "./erroresZod.js";

/**
 * Schema para POST /api/mensajes
 * Basado en el modelo Mensaje del schema.prisma
 */
export const schemaEnviarMensaje = z.object({
    id_conversacion: z
        .number(errorRequerido("El ID de conversación es obligatorio.", "El ID de conversación debe ser un número."))
        .int()
        .positive("El ID de conversación debe ser un ID válido."),

    mensaje: z
        .string(errorRequerido("El mensaje es obligatorio."))
        .min(1, "El mensaje no puede estar vacío.")
        .max(2000, "El mensaje no puede superar 2000 caracteres."),
});

/**
 * Schema para POST /api/conversaciones
 * Inicia una nueva conversación con otro usuario.
 */
export const schemaCrearConversacion = z.object({
    id_usuario_2: z
        .number(errorRequerido("El ID del destinatario es obligatorio.", "El ID del destinatario debe ser un número."))
        .int()
        .positive("El ID del destinatario debe ser un ID válido."),
});

/**
 * Schema para POST /api/conversacion
 * Inicia una conversación con otro usuario enviando el primer mensaje.
 * Si ya existe una conversación entre ambos usuarios, solo agrega el mensaje.
 */
export const schemaIniciarConversacion = z.object({
    id_usuario_2: z
        .number(errorRequerido("El ID del destinatario es obligatorio.", "El ID del destinatario debe ser un número."))
        .int()
        .positive("El ID del destinatario debe ser un ID válido."),

    mensaje: z
        .string(errorRequerido("El mensaje es obligatorio."))
        .min(1, "El mensaje no puede estar vacío.")
        .max(2000, "El mensaje no puede superar 2000 caracteres."),

    id_publicacion: z
        .number({ error: "El ID de la publicación debe ser un número." })
        .int()
        .positive("El ID de la publicación debe ser un ID válido.")
        .optional(),
});

export const schemaActualizarEstadoConversacion = z.object({
    estado_id: z.coerce.number().int().positive("El ID del estado debe ser válido."),
});

export type EnviarMensajeInput = z.infer<typeof schemaEnviarMensaje>;
export type CrearConversacionInput = z.infer<typeof schemaCrearConversacion>;
export type IniciarConversacionInput = z.infer<typeof schemaIniciarConversacion>;
