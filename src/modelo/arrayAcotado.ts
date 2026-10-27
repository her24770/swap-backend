import { z } from "zod";

/**
 * Array con un máximo de elementos que se revisa ANTES de validar cada elemento.
 *
 * Zod 4 corrige GHSA-mrhx-c7xc-m3w5. Esta comprobación previa se conserva como
 * defensa adicional: primero se valida el tamaño y, solo si está dentro del
 * límite, se valida cada elemento.
 *
 * `ajustar` permite agregar reglas al array ya validado (por ejemplo `.min(1)`).
 */
export const arrayAcotado = <T extends z.ZodTypeAny>(
    item: T,
    max: number,
    mensaje: string,
    ajustar: (array: z.ZodArray<T>) => z.ZodArray<T> = (array) => array
) => z.array(z.unknown()).max(max, mensaje).pipe(ajustar(z.array(item)));
