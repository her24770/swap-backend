import { Request, Response, NextFunction } from "express";
import { buscarConversacionPorId, actualizarConversacion } from "../repository/repositorioMensaje.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

/*
    Aceptar o bloquear la solicitud de conversacion.
    Solo el destinatario (id_usuario_2) puede responder la solicitud,
    y solo si la conversacion sigue en estado "pendiente".
    body: { estado_id: number } -> debe ser el id de "activo" (aceptar) o "inactivo" (bloquear)
*/
export async function actualizarEstadoConversacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idConversacion = Number(req.params.id);
        const { estado_id } = req.body; // El ID del nuevo estado
        const idToken = Number(req.usuario?.sub);

        //Validar ID de conversacion
        if (isNaN(idConversacion)) {
            errorResponse(res, "El ID de la conversacion no es valido", 400);
            return;
        }

        //Validar que se envio el estado
        if (!estado_id) {
            errorResponse(res, "El ID del nuevo estado es requerido", 400);
            return;
        }

        //Verificar existencia de la conversacion
        const conversacion = await buscarConversacionPorId(idConversacion);
        if (!conversacion) {
            errorResponse(res, "Conversacion no encontrada", 404);
            return;
        }

        //Verificar que el usuario autenticado es el destinatario de la solicitud
        if (conversacion.id_usuario_2 !== idToken) {
            errorResponse(res, "No tienes permiso para responder esta solicitud. Solo el destinatario puede aceptarla o bloquearla", 403);
            return;
        }

        //Obtener estados permitidos (activo, inactivo y pendiente)
        const estadoActivo = await obtenerEstadoPorNombre("activo");
        const estadoInactivo = await obtenerEstadoPorNombre("inactivo");
        const estadoPendiente = await obtenerEstadoPorNombre("pendiente");

        //Validar que los estados existen en la BD
        if (!estadoActivo || !estadoInactivo || !estadoPendiente) {
            errorResponse(res, "Error de configuracion: Estados 'activo', 'inactivo' o 'pendiente' no encontrados", 500);
            return;
        }

        //Verificar que el estado solicitado es valido (activo o inactivo)
        const estadosPermitidos = [estadoActivo.id_estado, estadoInactivo.id_estado];
        if (!estadosPermitidos.includes(estado_id)) {
            errorResponse(res, `Estado invalido. Solo se puede responder con activo (${estadoActivo.id_estado}) para aceptar o inactivo (${estadoInactivo.id_estado}) para bloquear`, 400);
            return;
        }

        //Verificar que la solicitud siga pendiente de respuesta
        if (conversacion.estado_conversacion !== estadoPendiente.id_estado) {
            errorResponse(res, "Esta solicitud de conversacion ya fue respondida", 400);
            return;
        }

        //Actualizar el estado
        const conversacionActualizada = await actualizarConversacion(idConversacion, { estado_conversacion: estado_id });

        const nombreEstado = estado_id === estadoActivo.id_estado ? "activo" : "inactivo";
        const mensaje = nombreEstado === "activo" ? "Solicitud de conversacion aceptada exitosamente" : "Solicitud de conversacion bloqueada exitosamente";

        exitoResponse(res, {
            id_conversacion: conversacionActualizada.id_conversacion,
            estado: conversacionActualizada.estado_conversacion,
            estado_nombre: nombreEstado
        }, mensaje, 200);
    } catch (error) {
        next(error);
    }
}