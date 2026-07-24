import { z } from "zod";

export const solicitudAcuerdoSchema = z.object({
    fecha_entrega: z.coerce.date(),
    lugar_entrega: z.string().min(1, "El lugar de entrega es requerido"),
    observaciones: z.string().min(1, "Las observaciones son requeridas"),
    id_conversacion: z.number().min(1, "La conversacion es requerida")
});

export const actualizarEstadoAcuerdoSchema = z.object({
    estado: z.enum(["activo", "pendiente", "completado", "cancelado"])
});