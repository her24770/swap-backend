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
            errorResponse(res, "El usuario ya tiene el máximo de 3 anuncios activos", 400);
            return;
        }

        // Subir imagen a R2 si se proporciona
        let urlImagen = ""; 
        if (req.file) {

            // que el archivo sea una imagen válida, con formato  (jpeg, png, webp) y que no supere los 5MB
            if (!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) {
                errorResponse(res, "Tipo de archivo no permitido. Solo JPG, PNG o WEBP.", 400);
                return;
            }
            if (req.file.size > 5 * 1024 * 1024) {
                errorResponse(res, "El tamaño del archivo excede el límite de 5MB.", 400);
                return;
            }

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


        if (anuncio.id_usuario !== idUsuario) {
            errorResponse(res, "No tienes permiso para eliminar este anuncio", 403);
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
        if (req.body.titulo === undefined && req.body.descripcion === undefined && !req.file) {
            errorResponse(res, "Debe enviar al menos un campo o una imagen para actualizar", 400);
            return;
        }
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

        if (anuncioExistente.id_usuario !== Number(req.usuario?.sub)) {
            errorResponse(res, "No tienes permiso para editar este anuncio", 403);
            return;
        }
        // Si no se sube una nueva imagen, mantenemos la que ya tiene el anuncio existente
        let urlImagen = anuncioExistente.imagen_url;
        let urlAnteriorParaBorrar: string | null = null;

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

            // La anterior se borra solo después de confirmar la nueva en BD (más abajo).
            if (anuncioExistente.imagen_url && anuncioExistente.imagen_url !== "") {
                urlAnteriorParaBorrar = anuncioExistente.imagen_url;
            }
        }

        let anuncioActualizado;
        try {
            anuncioActualizado = await actualizarAnuncio(idAnuncio, {
                titulo: validacion.data.titulo,
                descripcion: validacion.data.descripcion,
                imagen_url: urlImagen,
            });
        } catch (dbError) {
            // La BD no confirmó: compensar borrando la imagen recién subida para no dejar un huérfano en R2.
            if (req.file) {
                try { await eliminarImagenR2(urlImagen); } catch { /* best-effort */ }
            }
            throw dbError;
        }

        // Solo ahora que la BD ya apunta a la imagen nueva, se borra la anterior.
        if (urlAnteriorParaBorrar) {
            try {
                await eliminarImagenR2(urlAnteriorParaBorrar);
            } catch (error) {
                console.error("Error eliminando imagen anterior de R2:", error);
            }
        }

        exitoResponse(res, anuncioActualizado, "Anuncio actualizado exitosamente", 200);
        return;
    } catch (error) {
        next(error);    
    }
}
