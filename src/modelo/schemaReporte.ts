import { z } from "zod";

/**
 * Schema para POST /api/reportes
 * Basado en el modelo Reporte del schema.prisma
 */
export const schemaCrearReporte = z.object({
    id_receptor: z
        .number({ required_error: "El ID del usuario reportado es obligatorio.", invalid_type_error: "El ID del usuario reportado debe ser un número." })
        .int()
        .positive("El ID del usuario reportado debe ser un ID válido."),

    motivo: z
        .number({ required_error: "El motivo del reporte es obligatorio.", invalid_type_error: "El motivo debe ser un número." })
        .int()
        .positive("El motivo debe ser un ID válido."),

    observaciones: z
        .string({ required_error: "Las observaciones son obligatorias." })
        .min(10, "Las observaciones deben tener al menos 10 caracteres.")
        .max(1000, "Las observaciones no pueden superar 1000 caracteres."),
});

export type CrearReporteInput = z.infer<typeof schemaCrearReporte>;