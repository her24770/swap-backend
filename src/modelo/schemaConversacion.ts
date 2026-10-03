import {z} from "zod"

export const schemaObtenerConversacion = z.object({
    id_usuario_1: z.number({
        required_error: "El ID del primer usuario es obligatorio.",
        invalid_type_error: "El ID del primer usuario debe ser un número."
    }).int().positive("El ID del primer usuario debe ser un número positivo."),

    id_usuario_2: z.number({
        required_error: "El ID del segundo usuario es obligatorio.",
        invalid_type_error: "El ID del segundo usuario debe ser un número."
    }).int().positive("El ID del segundo usuario debe ser un número positivo."),

    estado_conversacion: z.number({
        required_error: "El estado de la conversación es obligatorio.",
        invalid_type_error: "El estado de la conversación debe ser un número."
    }).int().positive("El estado de la conversación debe ser un número positivo.")
});

export type ObtenerConversacionInput = z.infer<typeof schemaObtenerConversacion>;