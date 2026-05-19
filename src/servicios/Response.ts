import { Response } from "express";

/*
 * Metodo que permite enviar una respuesta exitosa al cliente
 * @param res - Response - Objeto Response de express
 * @param data - any - Datos a enviar al cliente
 * @param message - string - Mensaje a enviar al cliente
 * @param status - number - Estado de la respuesta
 */
export const exitoResponse = (
    res: Response,
    data: any = [],
    message: string = "Operacion exitosa",
    status: number = 200
): void => {
    res.status(status).json({
        success: true,
        message: message,
        data: data
    });
}

export const errorResponse = (
    res: Response,
    message: string = "Error",
    status: number = 400
): void => {
    res.status(status).json({
        success: false,
        message: message,
    });
}

/*
 * Metodo que permite enviar una respuesta de error de validacion con Zod al cliente
 * @param res - Response - Objeto Response de express
 * @param errores - any[] - Errores de validacion
 * @param message - string - Mensaje de error de validacion
 */
export const errorValidacionResponse = (
    res: Response,
    errores: any[],
    message: string = "Error de validación"
): void => {
    res.status(400).json({
        success: false,
        message: message,
        errores: errores.map(err => ({
            campo: err.path.join("."),
            mensaje: err.message
        }))
    });
};