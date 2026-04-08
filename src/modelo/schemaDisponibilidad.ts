import { z } from "zod";

/**
 * Schema para POST /api/disponibilidad
 * Basado en el modelo TiempoDisponible del schema.prisma
 */
export const schemaCrearDisponibilidad = z.object({
    inicio_intervalo: z
        .string({ required_error: "La fecha de inicio es obligatoria." })
        .datetime({ message: "La fecha de inicio debe ser una fecha válida en formato ISO 8601." }),

    fin_intervalo: z
        .string({ required_error: "La fecha de fin es obligatoria." })
        .datetime({ message: "La fecha de fin debe ser una fecha válida en formato ISO 8601." }),

    estado: z
        .number({ invalid_type_error: "El estado debe ser un número." })
        .int()
        .positive()
        .optional(),
}).refine(
    (data) => new Date(data.fin_intervalo) > new Date(data.inicio_intervalo),
    {
        message: "La fecha de fin debe ser posterior a la fecha de inicio.",
        path: ["fin_intervalo"],
    }
);

/**
 * Schema para PUT /api/disponibilidad/:id
 */
export const schemaEditarDisponibilidad = z.object({
    inicio_intervalo: z
        .string()
        .datetime({ message: "La fecha de inicio debe ser una fecha válida en formato ISO 8601." })
        .optional(),

    fin_intervalo: z
        .string()
        .datetime({ message: "La fecha de fin debe ser una fecha válida en formato ISO 8601." })
        .optional(),

    estado: z
        .number({ invalid_type_error: "El estado debe ser un número." })
        .int()
        .positive()
        .optional(),
}).refine(
    (data) => {
        if (data.inicio_intervalo && data.fin_intervalo) {
            return new Date(data.fin_intervalo) > new Date(data.inicio_intervalo);
        }
        return true;
    },
    {
        message: "La fecha de fin debe ser posterior a la fecha de inicio.",
        path: ["fin_intervalo"],
    }
);

export type CrearDisponibilidadInput = z.infer<typeof schemaCrearDisponibilidad>;
export type EditarDisponibilidadInput = z.infer<typeof schemaEditarDisponibilidad>;