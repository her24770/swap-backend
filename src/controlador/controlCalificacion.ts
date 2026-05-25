import { Request, Response, NextFunction } from "express";
import { schemaCrearCalificacion, schemaEditarCalificacion } from "../modelo/schemaCalificacion";
import { 
    crearCalificacion, 
    actualizarCalificacion,
    buscarCalificacionPorId,
    verificarCalificacionExistente, 
    calcularPromedioCalificacion,
    buscarCalificacionesPorUsuario
} from "../repository/repositorioCalificacion";
import { errorResponse, exitoResponse, errorValidacionResponse } from "../servicios/Response.js";
import { actualizarUsuario, buscarUsuarioPorId } from "../repository/repositorioUsuario";

/**
 * 1. REGISTRAR NUEVA CALIFICACIÓN (POST)
 */
export async function registrarCalificacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idCalificador = Number(req.usuario?.sub); 
        
        // Validación temprana del token
        if (!idCalificador || isNaN(idCalificador)) {
            errorResponse(res, "Usuario no autenticado o sesión inválida.", 401);
            return;
        }
        
        const payload = {
            id_usuario_calificador: idCalificador,
            id_usuario_calificado: Number(req.body.id_usuario_calificado),
            calificacion: Number(req.body.calificacion),
        };

        const validacion = schemaCrearCalificacion.safeParse(payload);
        if (!validacion.success) {
            errorValidacionResponse(res, validacion.error.errors);
            return;
        }

        const { id_usuario_calificado, calificacion } = validacion.data;

        // Verificar existencia del usuario calificado
        const destinoExiste = await buscarUsuarioPorId(id_usuario_calificado);
        if (!destinoExiste) {
            errorResponse(res, "El estudiante al que intentas calificar no existe.", 404);
            return;
        }

        // Control anti-spam
        const yaCalificado = await verificarCalificacionExistente(idCalificador, id_usuario_calificado);
        if (yaCalificado) {
            errorResponse(res, "Ya has evaluado a este usuario anteriormente.", 400);
            return;
        }

        const nuevaCalificacion = await crearCalificacion({
            id_usuario_calificador: idCalificador,
            id_usuario_calificado,
            calificacion,
        });

        // Recalcular y actualizar reputación
        const { promedio } = await calcularPromedioCalificacion(id_usuario_calificado);
        await actualizarUsuario(id_usuario_calificado, {
            calificacion: promedio 
        });

        exitoResponse(res, nuevaCalificacion, "Calificación registrada y reputación actualizada.", 201);
        return;
    } catch (error) {
        next(error);
    }
}

/**
 * 2. MODIFICAR CALIFICACIÓN EXISTENTE (PUT)
 */
export async function editarCalificacionUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idCalificacion = Number(req.params.id_calificacion);
        // Ajuste de seguridad: Confiar únicamente en el JWT extraído del middleware
        const idCalificador = Number(req.usuario?.sub);

        if (isNaN(idCalificacion)) {
            errorResponse(res, "El ID de la calificación provisto no es válido.", 400);
            return;
        }

        if (!idCalificador || isNaN(idCalificador)) {
            errorResponse(res, "Usuario no autenticado o sesión inválida.", 401);
            return;
        }

        const validacion = schemaEditarCalificacion.safeParse({
            calificacion: Number(req.body.calificacion)
        });
        if (!validacion.success) {
            errorValidacionResponse(res, validacion.error.errors);
            return;
        }

        // Buscar el registro original
        const registroOriginal = await buscarCalificacionPorId(idCalificacion);
        if (!registroOriginal) {
            errorResponse(res, "La calificación solicitada no existe.", 404);
            return;
        }

        // Control de propiedad estricto
        if (registroOriginal.id_usuario_calificador !== idCalificador) {
            errorResponse(res, "No posees los permisos requeridos para modificar esta calificación.", 403);
            return;
        }

        // Guardar cambios en DB
        const calificacionActualizada = await actualizarCalificacion(idCalificacion, validacion.data);

        // Recalcular y actualizar promedio
        const { promedio } = await calcularPromedioCalificacion(registroOriginal.id_usuario_calificado);
        await actualizarUsuario(registroOriginal.id_usuario_calificado, { calificacion: promedio });

        exitoResponse(res, calificacionActualizada, "Calificación modificada y promedio recalculado.", 200);
        return;
    } catch (error) {
        next(error);
    }
}

/**
 * 3. OBTENER EL HISTORIAL DE CALIFICACIONES DE UN PERFIL (GET)
 */
export async function obtenerCalificacionesDeUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id_usuario);
        if (isNaN(idUsuario)) {
            errorResponse(res, "El ID del usuario provisto no es válido.", 400);
            return;
        }

        const perfilExiste = await buscarUsuarioPorId(idUsuario);
        if (!perfilExiste) {
            errorResponse(res, "El usuario consultado no existe.", 404);
            return;
        }

        const historial = await buscarCalificacionesPorUsuario(idUsuario);
        
        exitoResponse(res, historial, "Historial de calificaciones obtenido correctamente.", 200);
        return;
    } catch (error) {
        next(error);
    }
}