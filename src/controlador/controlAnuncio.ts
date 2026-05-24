import { Request, Response, NextFunction } from "express";
import { schemaCrearAnuncio, schemaEditarAnuncio }  from "../modelo/schemaAnuncio";
import { buscarAnunciosPorUsuario, crearAnuncio, actualizarAnuncio, eliminarAnuncio, buscarAnuncios, buscarAnuncioPorId} from '../repository/repositorioAnuncio'
import { errorResponse, exitoResponse, errorValidacionResponse } from "../servicios/Response.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";
import { subirImagenR2, eliminarImagenR2 } from "../servicios/servicioR2.js";

export async function obtenerAnunciosUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id_usuario = Number(req.params.id_usuario);

        if (isNaN(id_usuario)) {
            errorResponse(res, "El id del usuario no es valido", 400);
            return;
        }

        const usuario = await buscarUsuarioPorId(id_usuario);
        if (!usuario) {
            errorResponse(res, "El usuario no existe", 404);
            return;
        }

        const anuncios = await buscarAnunciosPorUsuario(id_usuario);

        exitoResponse(res, anuncios, "Anuncios obtenidos exitosamente", 200);
        return; 
    } catch (error) {
        next(error);
    }
}

export async function obtenerTodosLosAnuncios(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const limit = Math.min(Number(req.query.limit) || 10, 100); 
        const order = req.query.order === 'asc' ? 'asc' : 'desc';

        if (isNaN(limit) || limit <= 0 || limit > 100) {
            errorResponse(res, "El parámetro 'limit' debe ser un número positivo entre 1 y 100", 400);
            return;
        }
        
        const anuncios = await buscarAnuncios({ limit, order });

        exitoResponse(res, anuncios, "Anuncios obtenidos exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function crearAnuncioUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const bodyData = {
            titulo: req.body.titulo,
            descripcion: req.body.descripcion,
        };        

        // Validar los datos de entrada con Zod
        const validacion = schemaCrearAnuncio.safeParse(bodyData);
        if (!validacion.success) {
            errorValidacionResponse(res, validacion.error.errors);
            return;
        }

        // Que el usuario esté autenticado
        const idUsuario = Number(req.usuario?.sub);
        if (!idUsuario) {
            errorResponse(res, "Usuario no autenticado", 401);
            return;
        }

        // Que el usuario exista
        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }


        // Que el usuario no tenga ya 5 anuncios activos
        const anunciosUsuario = await buscarAnunciosPorUsuario(idUsuario);
        if (anunciosUsuario.length >= 3) {
            errorResponse(res, "El usuario ya tiene el máximo de 5 anuncios activos", 400);
            return;
        }

        // Subir imagen a R2 si se proporciona
        let urlImagen = ""; 
        if (req.file) {
            try {
                const resultadoR2 = await subirImagenR2(
                    req.file.buffer,
                    req.file.mimetype,
                    'anuncios',
                    `anuncio_${idUsuario}_${Date.now()}`
                );
                urlImagen = resultadoR2 || "";
            } catch (error) {
                errorResponse(res, "Error subiendo imagen a R2", 500);
                return;
            }
        }

        const nuevoAnuncio = await crearAnuncio({
                titulo: validacion.data.titulo,
                descripcion: validacion.data.descripcion,
                imagen_url: urlImagen, 
                usuario: {
                    connect: { id_usuario: idUsuario } 
                }
            });

        exitoResponse(res, nuevoAnuncio, "Anuncio creado exitosamente", 201);
        return;
    } catch (error) {
        next(error);
    }
}     

export async function eliminarAnuncioUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idAnuncio = Number(req.params.id_anuncio);
        const idUsuario = Number(req.usuario?.sub);

        if (isNaN(idAnuncio)) {
            errorResponse(res, "El id del anuncio no es válido", 400);
            return;
        }

        if (!idUsuario) {
            errorResponse(res, "Usuario no autenticado", 401);
            return;
        }

        const anuncio = await buscarAnuncioPorId(idAnuncio);

        if (!anuncio) {
            errorResponse(res, "Anuncio no encontrado", 404);
            return;
        }

        // Eliminar imagen de R2 si existe y no está vacía
        if (anuncio.imagen_url && anuncio.imagen_url !== "") {
            try {
                await eliminarImagenR2(anuncio.imagen_url);
            } catch (error) {
                console.error("Error eliminando imagen de R2:", error);
            }
        }

        await eliminarAnuncio(idAnuncio);

        exitoResponse(res, anuncio, "Anuncio eliminado exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }   
}

export async function editarAnuncioUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {    
    try {
        const idAnuncio = Number(req.params.id_anuncio);        
        const bodyData = {
            titulo: req.body.titulo,
            descripcion: req.body.descripcion,
        };  
        const validacion = schemaEditarAnuncio.safeParse(bodyData);
        if (!validacion.success) {
            errorValidacionResponse(res, validacion.error.errors);
            return;
        }

        if (isNaN(idAnuncio)) {
            errorResponse(res, "El id del anuncio no es válido", 400);
            return;
        }

        const anuncioExistente = await buscarAnuncioPorId(idAnuncio);
        if (!anuncioExistente) {
            errorResponse(res, "Anuncio no encontrado", 404);
            return;
        }

        // Si no se sube una nueva imagen, mantenemos la que ya tiene el anuncio existente
        let urlImagen = anuncioExistente.imagen_url; 
        
        if (req.file) {
            try {
                const resultadoR2 = await subirImagenR2(
                    req.file.buffer,
                    req.file.mimetype,
                    'anuncios',
                    `anuncio_${idAnuncio}_${Date.now()}`
                );
                urlImagen = resultadoR2 || "";
            } catch (error) {
                errorResponse(res, "Error subiendo imagen a R2", 500);
                return;
            }

            // Eliminar imagen anterior de R2 si existía una válida
            if (anuncioExistente.imagen_url && anuncioExistente.imagen_url !== "") {
                try {
                    await eliminarImagenR2(anuncioExistente.imagen_url);
                } catch (error) {
                    console.error("Error eliminando imagen anterior de R2:", error);
                }
            }
        }

        const anuncioActualizado = await actualizarAnuncio(idAnuncio, {
            titulo: validacion.data.titulo,
            descripcion: validacion.data.descripcion,
            imagen_url: urlImagen,
        });

        exitoResponse(res, anuncioActualizado, "Anuncio actualizado exitosamente", 200);
        return;
    } catch (error) {
        next(error);    
    }
}