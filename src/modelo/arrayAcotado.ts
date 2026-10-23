import { z } from "zod";

/**
 * Array con un máximo de elementos que se revisa ANTES de validar cada elemento.
 *
 * En zod 3, `z.array(item).max(n)` valida igual todos los elementos y acumula un
 * error por cada uno que falle, así que un array enorme puede agotar la memoria
 * (GHSA-mrhx-c7xc-m3w5). Aquí primero se comprueba el tamaño con elementos sin
 * validar y, solo si está dentro del límite, se valida cada elemento.
 *
 * `ajustar` permite agregar reglas al array ya validado (por ejemplo `.min(1)`).
 */
export const arrayAcotado = <T extends z.ZodTypeAny>(
    item: T,
    max: number,
    mensaje: string,
    ajustar: (array: z.ZodArray<T>) => z.ZodArray<T> = (array) => array
) => z.array(z.unknown()).max(max, mensaje).pipe(ajustar(z.array(item)));
