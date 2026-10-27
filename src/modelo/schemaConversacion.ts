import { z } from "zod";
import { errorRequerido } from "./erroresZod.js";

export const schemaObtenerConversacion = z.object({
    id_usuario_1: z.number(errorRequerido(
        "El ID del primer usuario es obligatorio.",
        "El ID del primer usuario debe ser un número."
    )).int().positive("El ID del primer usuario debe ser un número positivo."),

    id_usuario_2: z.number(errorRequerido(
        "El ID del segundo usuario es obligatorio.",
        "El ID del segundo usuario debe ser un número."
    )).int().positive("El ID del segundo usuario debe ser un número positivo."),

    estado_conversacion: z.number(errorRequerido(
        "El estado de la conversación es obligatorio.",
        "El estado de la conversación debe ser un número."
    )).int().positive("El estado de la conversación debe ser un número positivo.")
});

export type ObtenerConversacionInput = z.infer<typeof schemaObtenerConversacion>;
