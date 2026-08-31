import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { buscarPublicacionesPorTipoYUsuario, buscarPublicacionesPaginadas, buscarPublicacionPorId, actualizarPublicacion, actualizarEstadoPublicacion, buscarPublicacionPorIdDetallado, buscarImagenesPorPublicacion, eliminarImagen, buscarPublicacionesPorFiltros, buscarPublicacionesDestacadasUsuario, buscarPublicacionesModeracion } from "../repository/repositorioPublicacion.js";
import { obtenerTipoPerfilPorNombre } from "../repository/repositorioTipoPerfil.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";
import { subirImagenR2, eliminarImagenR2 } from "../servicios/servicioR2.js";
import { schemaCrearPublicacion, } from "../modelo/schemaPublicacion.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { errorResponse, exitoResponse, errorValidacionResponse } from "../servicios/Response.js";
import { generarYGuardarEmbedding } from "../servicios/servicioEmbedding.js";
import { moderarImagenesEnBackground } from "../servicios/servicioModerarImagenesBackground.js";
import {contarPublicacionesDestacadasPorTipoYUsuario,actualizarDestacado} from "../repository/repositorioPublicacion.js";
import {registrarInteraccionPublicacion} from "../autenticacion/eventoRecomendacion.js";
import { obtenerJustificanteModeracion, notificarAccionModeracion } from "../servicios/servicioModeracion.js";

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

        const idUsuario = Number(req.usuario?.sub) || undefined;
        const resultado = await buscarPublicacionesPaginadas({
            page,
            limit,
            sort: sort as any,
            order,
            tipo,
            estado
        }, idUsuario);

        if (!resultado || resultado.publicaciones.length == 0) {
            errorResponse(res, "No se encontraron publicaciones", 404);
            return;
        }

        exitoResponse(res, {
            publicaciones: resultado.publicaciones,
            total: resultado.total
        }, "Publicaciones obtenidas exitosamente", 200);
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
        const idUsuario = Number(req.usuario?.sub);
        const publicacion = await buscarPublicacionPorIdDetallado(id, idUsuario);
        if (!publicacion) {
            errorResponse(res, "Publicacion no encontrada", 404);
            return;
        }

        //Verificar si el usuario que hace la consulta es el mismo de publicacion
        if (idUsuario !== publicacion.id_usuario) {
            //registrar evento de visualizacion
            registrarInteraccionPublicacion(idUsuario, publicacion.id_publicacion, "VER_PUBLICACION").catch((error) => {
                console.error(
                    "[Recomendacion] Error registrando visualizacion:",
                    error
                );
            });
        }

        exitoResponse(res, publicacion, "Publicacion obtenida exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerPublicacionesPorFiltros(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const options = req.body;
        const publicaciones = await buscarPublicacionesPorFiltros(options);
        if (!publicaciones) {
            errorResponse(res, "No se encontraron publicaciones que coincidan con los filtros", 404);
            return;
        }
        exitoResponse(res, {
            publicaciones,
            total: publicaciones.length,
            page: options.page,
            limit: options.limit
        }, "Publicaciones obtenidas exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

export async function obtenerPublicacionesModeracion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
        const sort = req.query.sort as string || "fecha";
        const order = req.query.order === "asc" ? "asc" : "desc";
        const tipo = req.query.tipo as string | undefined;
        const estado = req.query.estado as string | undefined;
        const q = req.query.q as string | undefined;

        const sortsValidos = ["fecha", "me_gusta", "precio"];
        if (!sortsValidos.includes(sort)) {
            errorResponse(res, "El parámetro sort debe ser uno de los siguientes: fecha, me_gusta, precio", 400);
            return;
        }

        const tiposValidos = ["negocio", "material", "tutoria"];
        if (tipo && !tiposValidos.includes(tipo)) {
            errorResponse(res, "El parámetro tipo debe ser uno de los siguientes: negocio, material, tutoria", 400);
            return;
        }

        const resultado = await buscarPublicacionesModeracion({
            page,
            limit,
            sort: sort as "fecha" | "me_gusta" | "precio",
            order,
            tipo,
            estado,
            q
        });

        exitoResponse(res, {
            publicaciones: resultado.publicaciones,
            total: resultado.total,
            page,
            limit
        }, "Publicaciones de moderación obtenidas exitosamente", 200);
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
            imagenes: [],
            destacar: req.body.destacar 
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
                is_pinned: validacion.data.destacar
            }
        });

        // Subir imágenes a R2 y guardarlas en BD
        const archivos = ((req.files as Express.Multer.File[]) ?? []).filter(f => f.fieldname === 'imagenes');
        const urlsImagenes: string[] = [];
        const imagenesParaModerar: { idImagen: number; url: string; buffer: Buffer }[] = [];
        for (const archivo of archivos) {
            try {
                const url = await subirImagenR2(
                    archivo.buffer,
                    archivo.mimetype,
                    'publicaciones',
                    `post_${publicacion.id_publicacion}_${crypto.randomUUID()}`
                );
                const imagenGuardada = await prisma.imagenPublicacion.create({
                    data: { url_imagen: url, id_publicacion: publicacion.id_publicacion }
                });
                urlsImagenes.push(url);
                imagenesParaModerar.push({ idImagen: imagenGuardada.id_imagen, url, buffer: archivo.buffer });
            } catch {
                // Si falla una imagen se continúa con las demás
            }
        }

        exitoResponse(res, {
            id_publicacion: publicacion.id_publicacion,
            imagenes: urlsImagenes
        }, "Publicacion creada exitosamente", 201);

        const textoEmbedding = `${validacion.data.titulo} ${validacion.data.descripcion}`;
        generarYGuardarEmbedding(publicacion.id_publicacion, textoEmbedding).catch(() => {});

        if (imagenesParaModerar.length > 0) {
            moderarImagenesEnBackground(publicacion.id_publicacion, idUsuario, imagenesParaModerar).catch(() => {});
        }

        return;
    } catch (error) {
        next(error);
    }
}

export async function editarPublicacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id_publicacion = Number(req.params.id);

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

        const body = req.body;
        const updateData: Record<string, unknown> = {};

        if (body.titulo !== undefined)      updateData.titulo      = body.titulo;
        if (body.descripcion !== undefined) updateData.descripcion = body.descripcion;
        if (body.precio !== undefined)      updateData.precio      = Number(body.precio);

        if (body.estado !== undefined) {
            const estadoObj = await obtenerEstadoPorNombre(body.estado);
            if (!estadoObj) {
                errorResponse(res, `Estado inválido: "${body.estado}".`, 400);
                return;
            }
            updateData.estado = estadoObj.id_estado;
        }

        if (body.tipo_publicacion !== undefined) {
            const tipoPerfil = await obtenerTipoPerfilPorNombre(body.tipo_publicacion);
            if (!tipoPerfil) {
                errorResponse(res, `Tipo de publicación inválido: "${body.tipo_publicacion}".`, 400);
                return;
            }
            updateData.tipo_publicacion = tipoPerfil.id_tipo_perfil;
        }

        if (Object.keys(updateData).length > 0) {
            await actualizarPublicacion(id_publicacion, updateData);
        }

        // Actualizar etiquetas
        const etiquetasIds: number[] | undefined = body.etiquetas
            ? (Array.isArray(body.etiquetas) ? body.etiquetas : JSON.parse(body.etiquetas))
            : undefined;
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

        // Eliminar imágenes indicadas
        const urlsEliminar: string[] = body.imagenesEliminar
            ? (Array.isArray(body.imagenesEliminar) ? body.imagenesEliminar : JSON.parse(body.imagenesEliminar))
            : [];
        const imagenesActuales = await buscarImagenesPorPublicacion(id_publicacion);

        for (const url of urlsEliminar) {
            const imagen = imagenesActuales.find((img) => img.url_imagen === url);
            if (imagen) {
                try { await eliminarImagenR2(url); } catch { /* continúa si falla R2 */ }
                await eliminarImagen(imagen.id_imagen);
            }
        }

        // Subir nuevas imágenes
        const MAX_IMAGENES = 5;
        const imagenesRestantes = imagenesActuales.filter((img) => !urlsEliminar.includes(img.url_imagen));
        const archivos = ((req.files as Express.Multer.File[]) ?? []).filter(f => f.fieldname === 'imagenes');
        const disponibles = MAX_IMAGENES - imagenesRestantes.length;

        if (archivos.length > disponibles) {
            errorResponse(res, `Solo puedes agregar ${disponibles} imagen(es) más. La publicación ya tiene ${imagenesRestantes.length} y el máximo es ${MAX_IMAGENES}.`, 400);
            return;
        }

        const prisma = require("../persistencia/prismaClient.js").default;
        const urlsNuevas: string[] = [];
        const imagenesParaModerar: { idImagen: number; url: string; buffer: Buffer }[] = [];
        for (const archivo of archivos) {
            try {
                const url = await subirImagenR2(archivo.buffer, archivo.mimetype, 'publicaciones', `post_${id_publicacion}_${crypto.randomUUID()}`);
                const imagenGuardada = await prisma.imagenPublicacion.create({ data: { url_imagen: url, id_publicacion } });
                urlsNuevas.push(url);
                imagenesParaModerar.push({ idImagen: imagenGuardada.id_imagen, url, buffer: archivo.buffer });
            } catch { /* continúa si falla una imagen */ }
        }

        const idUsuario = Number(req.usuario?.sub);
        const imagenesFinales = await buscarImagenesPorPublicacion(id_publicacion);
        exitoResponse(res, { imagenes: imagenesFinales, urlsNuevas }, "Publicacion actualizada exitosamente", 200);

        if (body.titulo !== undefined || body.descripcion !== undefined) {
            const tituloFinal = body.titulo ?? publicacion.titulo;
            const descripcionFinal = body.descripcion ?? publicacion.descripcion;
            generarYGuardarEmbedding(id_publicacion, `${tituloFinal} ${descripcionFinal}`).catch(() => {});
        }

        if (imagenesParaModerar.length > 0) {
            moderarImagenesEnBackground(id_publicacion, idUsuario, imagenesParaModerar).catch(() => {});
        }

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

export async function eliminarPublicacionModeracion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id_publicacion = Number(req.params.id);
        const justificante = obtenerJustificanteModeracion(req.body);

        if (isNaN(id_publicacion)) {
            errorResponse(res, "El ID de la publicación no es válido", 400);
            return;
        }

        if (!justificante) {
            errorResponse(res, "Debes indicar un motivo para eliminar la publicación", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorId(id_publicacion);
        if (!publicacion) {
            errorResponse(res, "Publicación no encontrada", 404);
            return;
        }

        const estadoEliminado = await obtenerEstadoPorNombre("eliminado");
        if (!estadoEliminado) {
            errorResponse(res, "Error de configuracion: Estado 'eliminado' no encontrado", 500);
            return;
        }

        if (publicacion.estado === estadoEliminado.id_estado) {
            errorResponse(res, "La publicación ya fue eliminada", 409);
            return;
        }

        const actualizada = await actualizarEstadoPublicacion(id_publicacion, estadoEliminado.id_estado);

        const detalle = justificante.detalle ? ` Detalle: ${justificante.detalle}` : "";
        await notificarAccionModeracion(
            publicacion.id_usuario,
            `Tu publicación "${publicacion.titulo}" fue eliminada por moderación. Motivo: ${justificante.motivo}.${detalle}`
        );

        exitoResponse(res, {
            id_publicacion: actualizada.id_publicacion,
            titulo: actualizada.titulo,
            estado: actualizada.estado,
            estado_nombre: "eliminado"
        }, "Publicación eliminada por moderación exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function bajarPublicacionModeracion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        const justificante = obtenerJustificanteModeracion(req.body);

        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicación no es válido", 400);
            return;
        }

        if (!justificante) {
            errorResponse(res, "Debes indicar un motivo para bajar la publicación", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            errorResponse(res, "Publicación no encontrada", 404);
            return;
        }

        const estadoInactivo = await obtenerEstadoPorNombre("inactivo");
        if (!estadoInactivo) {
            errorResponse(res, "Error de configuracion: Estado 'inactivo' no encontrado", 500);
            return;
        }

        if (publicacion.estado === estadoInactivo.id_estado) {
            errorResponse(res, "La publicación ya está inactiva", 409);
            return;
        }

        const actualizada = await actualizarEstadoPublicacion(idPublicacion, estadoInactivo.id_estado);

        const detalle = justificante.detalle ? ` Detalle: ${justificante.detalle}` : "";
        await notificarAccionModeracion(
            publicacion.id_usuario,
            `Tu publicación "${publicacion.titulo}" fue bajada por moderación. Motivo: ${justificante.motivo}.${detalle}`
        );

        exitoResponse(res, {
            id_publicacion: actualizada.id_publicacion,
            titulo: actualizada.titulo,
            estado: actualizada.estado,
            estado_nombre: "inactivo"
        }, "Publicación bajada exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function reactivarPublicacionModeracion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        const justificante = obtenerJustificanteModeracion(req.body);

        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicación no es válido", 400);
            return;
        }

        if (!justificante) {
            errorResponse(res, "Debes indicar un motivo para reactivar la publicación", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            errorResponse(res, "Publicación no encontrada", 404);
            return;
        }

        const estadoActivo = await obtenerEstadoPorNombre("activo");
        if (!estadoActivo) {
            errorResponse(res, "Error de configuracion: Estado 'activo' no encontrado", 500);
            return;
        }

        if (publicacion.estado === estadoActivo.id_estado) {
            errorResponse(res, "La publicación ya está activa", 409);
            return;
        }

        const actualizada = await actualizarEstadoPublicacion(idPublicacion, estadoActivo.id_estado);

        const detalle = justificante.detalle ? ` Detalle: ${justificante.detalle}` : "";
        await notificarAccionModeracion(
            publicacion.id_usuario,
            `Tu publicación "${publicacion.titulo}" fue reactivada por moderación. Motivo: ${justificante.motivo}.${detalle}`
        );

        exitoResponse(res, {
            id_publicacion: actualizada.id_publicacion,
            titulo: actualizada.titulo,
            estado: actualizada.estado,
            estado_nombre: "activo"
        }, "Publicación reactivada exitosamente", 200);
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

export async function destacarPublicacion(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        const idUsuario = Number(req.usuario?.sub);
        const { destacar } = req.body;

        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicación no es válido", 400);
            return;
        }

        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            errorResponse(res, "Publicación no encontrada", 404);
            return;
        }

        // Solo el dueño puede destacar
        if (publicacion.id_usuario !== idUsuario) {
            errorResponse(res, "No tienes permiso para destacar esta publicación.", 403);
            return;
        }

        // Si ya está en el estado solicitado no hacer nada
        if (publicacion.is_pinned === destacar) {
            const estado = destacar ? "destacada" : "no destacada";
            errorResponse(res, `La publicación ya está ${estado}.`, 409);
            return;
        }

        // Validar máximo 3 destacadas por tipo si se está destacando
        if (destacar) {
            const totalDestacadas = await contarPublicacionesDestacadasPorTipoYUsuario(
                idUsuario,
                publicacion.tipo_publicacion
            );

            if (totalDestacadas >= 3) {
                errorResponse(res, "Ya tienes 3 publicaciones destacadas de este tipo. Quita una antes de destacar otra.", 400);
                return;
            }
        }

        const actualizada = await actualizarDestacado(idPublicacion, destacar);
        const accion = destacar ? "destacada" : "quitada de destacados";

        exitoResponse(res, actualizada, `Publicación ${accion} exitosamente`, 200);
    } catch (error) {
        next(error);
    }
}

export async function obtenerPublicacionesDestacadas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);

        if (isNaN(idUsuario)) {
            errorResponse(res, "El ID de usuario no es válido", 400);
            return;
        }

        const publicaciones = await buscarPublicacionesDestacadasUsuario(idUsuario);

        exitoResponse(res, publicaciones, "Publicaciones destacadas obtenidas exitosamente", 200);
        return;
    } catch (error) {
        next(error);
    }
}
