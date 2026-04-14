import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Middleware de validación con Zod.
 * Si falla, retorna 400 con los errores descriptivos.
 * Si pasa, llama a next() con los datos ya parseados en req.body.
 */
export function validar(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    message: "Datos inválidos.",
                    errores: error.errors.map((e) => ({
                        campo: e.path.join("."),
                        mensaje: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}