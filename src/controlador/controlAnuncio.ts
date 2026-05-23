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
        return 
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
        
        if (order !== 'asc' && order !== 'desc') {
            errorResponse(res, "El parámetro 'order' debe ser 'asc' o 'desc'", 400);
            return;
        }
        
        const anuncios = await buscarAnuncios({ limit, order });

        

        exitoResponse(res, anuncios, "Anuncios obtenidos exitosamente", 200);
        return

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

        // Subir imagen a R2 si se proporciona
        let urlImagen: string | null = null;
        if (req.file) {
            try {
                urlImagen = await subirImagenR2(
                    req.file.buffer,
                    req.file.mimetype,
                    'anuncios',
                    `anuncio_${idUsuario}_${Date.now()}`
                );
            } catch (error) {
                errorResponse(res, "Error subiendo imagen a R2", 500);
                return;
            }
        }


        // Crear el anuncio en la base de datos
        const nuevoAnuncio = await crearAnuncio({
            titulo: validacion.data.titulo,
            descripcion: validacion.data.descripcion,
            id_usuario: idUsuario,
            url_imagen: urlImagen || null,
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

        const anuncio = await eliminarAnuncio(idAnuncio);

        if (!anuncio) {
            errorResponse(res, "Anuncio no encontrado", 404);
            return;
        }

        // Eliminar imagen de R2 si existe
        if (anuncio.url_imagen) {
            try {
                await eliminarImagenR2(anuncio.url_imagen);
            } catch (error) {
                console.error("Error eliminando imagen de R2:", error);
            }
        }

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

        let urlImagen: string | null = null;
        if (req.file) {
            try {
                urlImagen = await subirImagenR2(
                    req.file.buffer,
                    req.file.mimetype,
                    'anuncios',
                    `anuncio_${idAnuncio}_${Date.now()}`
                );
            } catch (error) {
                errorResponse(res, "Error subiendo imagen a R2", 500);
                return;
            }

            // Eliminar imagen anterior de R2 si existe
            if (anuncioExistente.url_imagen) {
                try {
                    await eliminarImagenR2(anuncioExistente.url_imagen);
                } catch (error) {
                    console.error("Error eliminando imagen anterior de R2:", error);
                }
            }
        }

        // Actualizar el anuncio en la base de datos

        const anuncioActualizado = await actualizarAnuncio(idAnuncio, {
            titulo: validacion.data.titulo,
            descripcion: validacion.data.descripcion,
            url_imagen: urlImagen,
        });



        exitoResponse(res, anuncioActualizado, "Anuncio actualizado exitosamente", 200);
        return;

    } catch (error) {
        next(error);    
    }
}

