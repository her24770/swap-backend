import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import {
    buscarTodasLasPalabrasRestringidas,
    buscarPalabraRestringidaPorId,
    guardarPalabraRestringida,
    actualizarPalabraRestringida,
    eliminarPalabraRestringida,
} from "../repository/repositorioReporte.js";
import { CrearPalabraRestringidaInput, EditarPalabraRestringidaInput } from "../modelo/schemaPalabraRestringida.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

// GET /api/moderador/palabras
export async function listarPalabrasRestringidas(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const palabras = await buscarTodasLasPalabrasRestringidas();
        exitoResponse(res, palabras, "Palabras restringidas obtenidas exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

// POST /api/moderador/palabras
export async function crearPalabraRestringidaController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { palabra } = req.body as CrearPalabraRestringidaInput;
        const nueva = await guardarPalabraRestringida({ palabra });
        exitoResponse(res, nueva, "Palabra restringida creada exitosamente", 201);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            errorResponse(res, "Esa palabra ya está en la lista de restringidas.", 409);
            return;
        }
        next(error);
    }
}

// PATCH /api/moderador/palabras/:id
export async function editarPalabraRestringidaController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            errorResponse(res, "El id de la palabra no es válido.", 400);
            return;
        }

        const existente = await buscarPalabraRestringidaPorId(id);
        if (!existente) {
            errorResponse(res, "Palabra restringida no encontrada.", 404);
            return;
        }

        const { palabra } = req.body as EditarPalabraRestringidaInput;
        const actualizada = await actualizarPalabraRestringida(id, { palabra });
        exitoResponse(res, actualizada, "Palabra restringida actualizada exitosamente", 200);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            errorResponse(res, "Esa palabra ya está en la lista de restringidas.", 409);
            return;
        }
        next(error);
    }
}

// DELETE /api/moderador/palabras/:id
export async function eliminarPalabraRestringidaController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            errorResponse(res, "El id de la palabra no es válido.", 400);
            return;
        }

        const existente = await buscarPalabraRestringidaPorId(id);
        if (!existente) {
            errorResponse(res, "Palabra restringida no encontrada.", 404);
            return;
        }

        await eliminarPalabraRestringida(id);
        exitoResponse(res, null, "Palabra restringida eliminada exitosamente", 200);
    } catch (error) {
        next(error);
    }
}