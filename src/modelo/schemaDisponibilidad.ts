import { z } from "zod";

const DIAS_SEMANA = [
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
    "domingo",
] as const;

const horaSchema = z
    .string({ required_error: "La hora es obligatoria." })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener formato HH:mm.");

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

const bloqueHorarioSchema = z.object({
    dia: z.enum(DIAS_SEMANA, {
        required_error: "El día es obligatorio.",
        invalid_type_error: "El día no es válido.",
    }),
    hora_inicio: horaSchema,
    hora_fin: horaSchema,
}).refine(
    (data) => data.hora_fin > data.hora_inicio,
    {
        message: "La hora de fin debe ser posterior a la hora de inicio.",
        path: ["hora_fin"],
    }
);

/**
 * Schema para PUT /api/horarios/:usuarioId
 * Reemplaza todos los bloques disponibles del usuario en una sola petición.
 */
export const schemaActualizarHorario = z.object({
    bloques: z
        .array(bloqueHorarioSchema)
        .max(7 * 24, "No se pueden enviar más de 168 bloques por semana."),
}).refine(
    (data) => {
        const vistos = new Set<string>();
        return data.bloques.every((bloque) => {
            const key = `${bloque.dia}-${bloque.hora_inicio}-${bloque.hora_fin}`;
            if (vistos.has(key)) return false;
            vistos.add(key);
            return true;
        });
    },
    { message: "No se permiten bloques de horario duplicados." }
);

export type CrearDisponibilidadInput = z.infer<typeof schemaCrearDisponibilidad>;
export type EditarDisponibilidadInput = z.infer<typeof schemaEditarDisponibilidad>;
export type ActualizarHorarioInput = z.infer<typeof schemaActualizarHorario>;
