import { z } from "zod";

export const schemaCrearPalabraRestringida = z.object({
    palabra: z
        .string({ required_error: "La palabra es obligatoria." })
        .trim()
        .min(2, "La palabra debe tener al menos 2 caracteres.")
        .max(100, "La palabra no puede superar 100 caracteres.")
        .toLowerCase(),
});

export const schemaEditarPalabraRestringida = schemaCrearPalabraRestringida;

export type CrearPalabraRestringidaInput = z.infer<typeof schemaCrearPalabraRestringida>;
export type EditarPalabraRestringidaInput = z.infer<typeof schemaEditarPalabraRestringida>;