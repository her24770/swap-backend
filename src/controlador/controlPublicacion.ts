import { Request, Response, NextFunction } from "express";
import { buscarPublicacionesPorTipoYUsuario, buscarPublicacionesPaginadas, buscarPublicacionPorId, actualizarPublicacion, actualizarEstadoPublicacion, buscarPublicacionPorIdDetallado, buscarImagenesPorPublicacion, eliminarImagen } from "../repository/repositorioPublicacion.js";
import { obtenerTipoPerfilPorNombre } from "../repository/repositorioTipoPerfil.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";
import { subirImagenR2, eliminarImagenR2 } from "../servicios/servicioR2.js";
import { schemaCrearPublicacion, } from "../modelo/schemaPublicacion.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { errorResponse, exitoResponse, errorValidacionResponse } from "../servicios/Response.js";

export async function obtenerPublicacionesUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id); //Id del usuario
        const tipo = req.query.tipo as string; //Tipo de publicacion
        const all = req.query.all === "true"; //Indicador para obtener todas las publicaciones o solo las activas
        const estado = all ? undefined : 'activo'; //Si all es true, se obtienen todas las publicaciones, si no, solo las activas

        if (isNaN(idUsuario)) {
            errorResponse(res, "El id del usuario no es valido", 400);
            return;
        }
        if (!tipo) {
            errorResponse(res, "El tipo de publicacion es requerido para obtener las publicaciones", 400);
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "El usuario no existe", 404);
            return;
        }

        const tipoPerfil = await obtenerTipoPerfilPorNombre(tipo);
        if (!tipoPerfil) {
            errorResponse(res, "El tipo de publicacion no existe", 404);
            return;
        }

        const publicaciones = await buscarPublicacionesPorTipoYUsuario(tipo, idUsuario, estado);

        exitoResponse(res, publicaciones, "Publicaciones obtenidas exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerTodasLasPublicaciones(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const page = Math.max(1, Number(req.query.page) || 1); //Pagina actual
        const limit = Math.min(100, Number(req.query.limit) || 10); //Cantidad de publicaciones por pagina
        const sort = req.query.sort as string || 'fecha'; //Ordenar por fecha, me_gusta o precio
        const order = req.query.order as string === 'asc' ? 'asc' : 'desc'; //Orden ascendente o descendente
        const tipo = req.query.tipo as string | undefined; //Tipo de publicacion
        const all = req.query.all === "true"; //Indicador para obtener todas las publicaciones o solo las activas
        const estado = all ? undefined : 'activo'; //Si all es true, se obtienen todas las publicaciones, si no, solo las activas

        const sortsValidos = ['fecha', 'me_gusta', 'precio'];
        if (sort && !sortsValidos.includes(sort)) {
            errorResponse(res, "El parámetro sort debe ser uno de los siguientes: fecha, me_gusta, precio", 400);
            return;
        }

        if (tipo) {
            const tipoPerfil = await obtenerTipoPerfilPorNombre(tipo);
            if (!tipoPerfil) {
                errorResponse(res, "El tipo de publicacion no existe", 404);
                return;
            }
        }

        const resultado = await buscarPublicacionesPaginadas({
            page,
            limit,
            sort: sort as any,
            order,
            tipo,
            estado
        });

        if (!resultado || resultado.length == 0) {
            errorResponse(res, "No se encontraron publicaciones", 404);
            return;
        }

        exitoResponse(res, resultado, "Publicaciones obtenidas exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerPublicacionPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            errorResponse(res, "El id de la publicacion no es valido", 400);
            return;
        }
        const publicacion = await buscarPublicacionPorIdDetallado(id);
        if (!publicacion) {
            errorResponse(res, "Publicacion no encontrada", 404);
            return;
        }

        exitoResponse(res, publicacion, "Publicacion obtenida exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function crearPublicacionConImagen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // Validar datos del body
        const bodyData = {
            titulo: req.body.titulo,
            descripcion: req.body.descripcion,
            precio: req.body.precio ? Number(req.body.precio) : 0,
            tipo_publicacion: req.body.tipo_publicacion,
            estado: req.body.estado ?? undefined,
            imagenes: []
        };

        const validacion = schemaCrearPublicacion.safeParse(bodyData);
        if (!validacion.success) {
            errorValidacionResponse(res, validacion.error.errors);
            return;
        }

        // Obtener ID de usuario del token
        const idUsuario = Number(req.usuario?.sub);
        if (!idUsuario) {
            errorResponse(res, "Usuario no autenticado", 401);
            return;
        }

        // Validar que exista el usuario
        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }

        // Obtener el tipo de perfil por nombre
        const tipoPerfil = await obtenerTipoPerfilPorNombre(validacion.data.tipo_publicacion);

        if (!tipoPerfil) {
            errorResponse(res, "Tipo de publicacion no encontrado", 404);
            return;
        }

        // Si hay imagen, subirla a R2
        let urlImagen: string | null = null;
        if (req.file) {
            try {
                urlImagen = await subirImagenR2(
                    req.file.buffer,
                    req.file.mimetype,
                    'publicaciones',
                    `post_temp_${Date.now()}`
                );
            } catch (error) {
                errorResponse(res, "Error subiendo imagen a R2", 500);
                return;
            }
        }

        // Resolver estado texto → id_estado
        const nombreEstado = validacion.data.estado ?? "disponible";
        const estadoObj = await obtenerEstadoPorNombre(nombreEstado);
        if (!estadoObj) {
            errorResponse(res, `Estado inválido: "${nombreEstado}".`, 400);
            return;
        }
        const idEstado = estadoObj.id_estado;

        // Crear publicación
        const prisma = require("../persistencia/prismaClient.js").default;
        const publicacion = await prisma.publicacion.create({
            data: {
                titulo: validacion.data.titulo,
                descripcion: validacion.data.descripcion,
                precio: validacion.data.precio,
                tipo_publicacion: tipoPerfil.id_tipo_perfil,
                estado: idEstado,
                id_usuario: idUsuario,
                ...(urlImagen && {
                    imagenes: {
                        create: [{ url_imagen: urlImagen }]
                    }
                })
            }
        });

        exitoResponse(res, {
            id_publicacion: publicacion.id_publicacion,
            imagen_url: urlImagen
        }, "Publicacion creada exitosamente", 201);
        return;
    } catch (error) {
        next(error);
    }
}

export async function agregarOActualizarImagen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);

        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicacion no es valido", 400);
            return;
        }

        // Validar que exista la publicación
        const publicacion = await buscarPublicacionPorId(idPublicacion);

        //Validar que el usuario sea el dueño de la publicación
        if (publicacion?.id_usuario !== Number(req.usuario?.sub)) {
            errorResponse(res, "No tienes permiso para editar esta publicacion", 403);
            return;
        }

        if (!publicacion) {
            errorResponse(res, "Publicacion no encontrada", 404);
            return;
        }

        // Validar que haya archivo
        if (!req.file) {
            errorResponse(res, "No se proporciono archivo de imagen", 400);
            return;
        }

        // Eliminar imágenes anteriores de R2 y BD
        const imagenesActuales = await buscarImagenesPorPublicacion(idPublicacion);
        for (const img of imagenesActuales) {
            try {
                await eliminarImagenR2(img.url_imagen);
            } catch {
                // Si falla la eliminación en R2 se continúa de todas formas
            }
            await eliminarImagen(img.id_imagen);
        }

        // Subir nueva imagen a R2
        let urlImagen: string;
        try {
            urlImagen = await subirImagenR2(
                req.file.buffer,
                req.file.mimetype,
                'publicaciones',
                `post_${idPublicacion}`
            );
        } catch (error) {
            errorResponse(res, "Error subiendo imagen a R2", 500);
            return;
        }

        // Guardar nueva imagen en BD
        const prisma = require("../persistencia/prismaClient.js").default;
        const imagen = await prisma.imagenPublicacion.create({
            data: {
                url_imagen: urlImagen,
                id_publicacion: idPublicacion
            }
        });

        exitoResponse(res, {
            id_imagen: imagen.id_imagen,
            url_imagen: urlImagen
        }, "Imagen actualizada en la publicación", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function editarPublicacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id_publicacion = Number(req.params.id);
        const data = req.body;

        if (isNaN(id_publicacion)) {
            errorResponse(res, "El ID de la publicacion no es valido", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorId(id_publicacion);
        if (!publicacion) {
            errorResponse(res, "Publicacion no encontrada", 404);
            return;
        }

        if (publicacion.id_usuario !== Number(req.usuario?.sub)) {
            errorResponse(res, "No tienes permiso para editar esta publicacion. Solo el propietario puede hacer cambios", 403);
            return;
        }

        const updateData: Record<string, unknown> = { ...data };

        // Resolver estado string → id_estado numérico
        if (data.estado !== undefined) {
            const estadoObj = await obtenerEstadoPorNombre(data.estado);
            if (!estadoObj) {
                errorResponse(res, `Estado inválido: "${data.estado}".`, 400);
                return;
            }
            updateData.estado = estadoObj.id_estado;
        }

        // Resolver tipo_publicacion string → id_tipo_perfil numérico
        if (data.tipo_publicacion !== undefined) {
            const tipoPerfil = await obtenerTipoPerfilPorNombre(data.tipo_publicacion);
            if (!tipoPerfil) {
                errorResponse(res, `Tipo de publicación inválido: "${data.tipo_publicacion}".`, 400);
                return;
            }
            updateData.tipo_publicacion = tipoPerfil.id_tipo_perfil;
        }

        // Extraer etiquetas antes de actualizar (se manejan como relación aparte)
        const etiquetasIds: number[] | undefined = data.etiquetas;
        delete updateData.etiquetas;

        const publicacionActualizada = await actualizarPublicacion(id_publicacion, updateData);

        // Actualizar etiquetas si se enviaron
        if (etiquetasIds !== undefined) {
            const prismaClient = require("../persistencia/prismaClient.js").default;
            await prismaClient.publicacionEtiqueta.deleteMany({ where: { id_publicacion } });
            if (etiquetasIds.length > 0) {
                await prismaClient.publicacionEtiqueta.createMany({
                    data: etiquetasIds.map((id_etiqueta: number) => ({ id_publicacion, id_etiqueta })),
                    skipDuplicates: true,
                });
            }
        }

        exitoResponse(res, publicacionActualizada, "Publicacion actualizada exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function eliminarPublicacionConImagenes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id_publicacion = Number(req.params.id);

        if (isNaN(id_publicacion)) {
            errorResponse(res, "El ID de la publicación no es válido", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorIdDetallado(id_publicacion);
        if (!publicacion) {
            errorResponse(res, "Publicación no encontrada", 404);
            return;
        }

        if (publicacion.id_usuario !== Number(req.usuario?.sub)) {
            errorResponse(res, "No tienes permiso para eliminar esta publicación", 403);
            return;
        }

        // Borrar imágenes de R2
        for (const img of publicacion.imagenes ?? []) {
            try {
                await eliminarImagenR2(img.url_imagen);
            } catch {
                // Si falla R2 se continúa para que la BD quede limpia
            }
        }

        const prisma = require("../persistencia/prismaClient.js").default;

        // Eliminar registros relacionados antes de borrar la publicación
        await prisma.imagenPublicacion.deleteMany({ where: { id_publicacion } });
        await prisma.publicacionEtiqueta.deleteMany({ where: { id_publicacion } });

        await prisma.publicacion.delete({ where: { id_publicacion } });

        exitoResponse(res, {}, "Publicación eliminada exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function cambiarEstadoPublicacion(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        const { estado_id } = req.body; // El ID del nuevo estado
        //Validar ID de publicación
        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicacion no es valido", 400);
            return;
        }

        //Validar que se envió el estado
        if (!estado_id) {
            errorResponse(res, "El ID del nuevo estado es requerido", 400);
            return;
        }

        //Verificar existencia de la publicación
        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            errorResponse(res, "Publicacion no encontrada", 404);
            return;
        }

        //Verificar que el usuario es el propietario
        const idToken = Number(req.usuario?.sub);
        if (publicacion.id_usuario !== idToken) {
            errorResponse(res, "No tienes permiso para modificar esta publicacion. Solo el propietario puede cambiar su estado", 403);
            return;
        }

        //Obtener estados permitidos (activo e inactivo)
        const estadoActivo = await obtenerEstadoPorNombre("activo");
        const estadoInactivo = await obtenerEstadoPorNombre("inactivo");

        //Validar que los estados existen en la BD
        if (!estadoActivo || !estadoInactivo) {
            errorResponse(res, "Error de configuracion: Estados 'activo' o 'inactivo' no encontrados", 500);
            return;
        }

        //Verificar que el estado solicitado es válido (activo o inactivo)
        const estadosPermitidos = [estadoActivo.id_estado, estadoInactivo.id_estado];
        if (!estadosPermitidos.includes(estado_id)) {
            errorResponse(res, `Estado invalido. Solo se puede cambiar a activo (${estadoActivo.id_estado}) o inactivo (${estadoInactivo.id_estado})`, 400);
            return;
        }

        //Verificar que no sea el mismo estado actual
        if (publicacion.estado === estado_id) {
            errorResponse(res, `La publicación ya está en estado ${estado_id === estadoActivo.id_estado ? 'activo' : 'inactivo'}`, 400);
            return;
        }

        //Actualizar el estado
        const publicacionActualizada = await actualizarEstadoPublicacion(idPublicacion, estado_id);

        //Respuesta exitosa
        const nombreEstado = estado_id === estadoActivo.id_estado ? "activo" : "inactivo";
        exitoResponse(res, {
            id_publicacion: publicacionActualizada.id_publicacion,
            titulo: publicacionActualizada.titulo,
            estado: publicacionActualizada.estado,
            estado_nombre: nombreEstado
        }, `Publicacion marcada como ${nombreEstado} exitosamente`, 200);
        return;
    } catch (error) {
        next(error);
    }
}