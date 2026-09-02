import { Request, Response, NextFunction } from "express";
import { buscarPublicacionesPorTipoYUsuario, buscarPublicacionesPaginadas, buscarPublicacionPorId, actualizarEstadoPublicacion, buscarPublicacionPorIdDetallado, buscarPublicacionesPorFiltros, buscarPublicacionesDestacadasUsuario, buscarPublicacionesModeracion } from "../repository/repositorioPublicacion.js";
import { obtenerTipoPerfilPorNombre } from "../repository/repositorioTipoPerfil.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";
import {contarPublicacionesDestacadasPorTipoYUsuario,actualizarDestacado} from "../repository/repositorioPublicacion.js";
import {registrarInteraccionPublicacion} from "../autenticacion/eventoRecomendacion.js";
import { obtenerJustificanteModeracion, notificarAccionModeracion } from "../servicios/servicioModeracion.js";
import { buscarReportesPorPublicacion } from "../repository/repositorioReporte.js";
import { crearPublicacion, editarPublicacion as editarPublicacionServicio, eliminarPublicacionPropia } from "../servicios/servicioPublicacion.js";
import { ErrorServicio } from "../servicios/ErrorServicio.js";

function responderErrorServicio(res: Response, error: unknown): error is ErrorServicio {
    if (!(error instanceof ErrorServicio)) return false;
    errorResponse(res, error.message, error.status);
    return true;
}

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
        const idUsuario = Number(req.usuario?.sub);
        const resultado = await crearPublicacion({
            idUsuario,
            datos: req.body,
            archivos: (req.files as Express.Multer.File[]) ?? [],
        });
        exitoResponse(res, resultado, "Publicacion creada exitosamente", 201);
    } catch (error) {
        if (responderErrorServicio(res, error)) return;
        next(error);
    }
}

export async function editarPublicacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicacion no es valido", 400);
            return;
        }
        const resultado = await editarPublicacionServicio({
            idPublicacion,
            idUsuario: Number(req.usuario?.sub),
            datos: req.body,
            archivos: (req.files as Express.Multer.File[]) ?? [],
        });
        exitoResponse(res, resultado, "Publicacion actualizada exitosamente", 200);
    } catch (error) {
        if (responderErrorServicio(res, error)) return;
        next(error);
    }
}

export async function eliminarPublicacionConImagenes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        if (isNaN(idPublicacion)) {
            errorResponse(res, "El ID de la publicación no es válido", 400);
            return;
        }
        await eliminarPublicacionPropia(idPublicacion, Number(req.usuario?.sub));
        exitoResponse(res, {}, "Publicación eliminada exitosamente", 200);
    } catch (error) {
        if (responderErrorServicio(res, error)) return;
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

        //Verificar si existen reportes de la publicación
        const reportes = await buscarReportesPorPublicacion(idPublicacion, ["pendiente", "resuelto"]);
        if (reportes.length > 0) {
            errorResponse(res, "No se puede cambiar el estado de la publicación porque tiene reportes pendientes", 409);
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
