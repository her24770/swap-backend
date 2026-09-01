import { Request, Response, NextFunction } from "express";
import {
    buscarConversacionPorId,
    actualizarConversacion,
    buscarConversacionesPorUsuario,
    buscarConversacionEntreDosUsuarios,
    buscarMensajesPorConversacion,
    guardarConversacion,
    buscarConversacionCompletaPorId
} from "../repository/repositorioMensaje.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";
import { crearMensajeYNotificar, notificarActualizacionConversacion } from "../servicios/servicioMensajeria.js";
import { IniciarConversacionInput } from "../modelo/schemaMensaje.js";
import { registrarContextoConversacion } from "../repository/repositorioContextoConversacion.js";
import { buscarPublicacionPorId } from "../repository/repositorioPublicacion.js";

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
        const conversacionActualizada = await actualizarConversacion(idConversacion, {
            estadoRel: { connect: { id_estado: estado_id } },
        });

        await notificarActualizacionConversacion(idConversacion, idToken);

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


export async function obtenerConversacionesDeUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {

    try {
        const idUsuario = Number(req.usuario?.sub);

        if (!idUsuario) {
            errorResponse(res, "Usuario no autenticado", 401);
            return;
        }

        const conversaciones = await buscarConversacionesPorUsuario(idUsuario);

        // Prisma no soporta ordenar un findMany por la fecha de una relación anidada
        // (el último mensaje, traído con take:1), así que se ordena en memoria.
        const conversacionesOrdenadas = [...conversaciones].sort((a, b) => {
            const fechaA = a.mensajes[0]?.fecha_enviado ?? null;
            const fechaB = b.mensajes[0]?.fecha_enviado ?? null;

            if (fechaA && fechaB) return fechaB.getTime() - fechaA.getTime();
            if (fechaA) return -1;
            if (fechaB) return 1;
            return b.id_conversacion - a.id_conversacion;
        });

        exitoResponse(res, conversacionesOrdenadas, "Conversaciones obtenidas exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

/*
    Inicia una conversación con otro usuario enviando el primer mensaje.
    Si ya existe una conversación entre ambos (en cualquier sentido), reutiliza
    esa conversación y solo agrega el mensaje nuevo.
    body: { id_usuario_2: number, mensaje: string }
*/
export async function iniciarConversacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);
        const { id_usuario_2, mensaje, id_publicacion } = req.body as IniciarConversacionInput;

        if (id_usuario_2 === idUsuario) {
            errorResponse(res, "No puedes iniciar una conversación contigo mismo", 400);
            return;
        }

        if (id_publicacion) {
            const publicacion = await buscarPublicacionPorId(id_publicacion);

            if (!publicacion) {
                errorResponse(res, "Publicación no encontrada", 404);
                return;
            }

            if (publicacion.id_usuario !== id_usuario_2) {
                errorResponse(
                    res,
                    "La publicación no pertenece al usuario con quien intentas iniciar la conversación",
                    400
                );
                return;
            }
        }

        let conversacion = await buscarConversacionEntreDosUsuarios(idUsuario, id_usuario_2);
        let conversacionNueva = false;

        if (!conversacion) {
            const estadoPendiente = await obtenerEstadoPorNombre("pendiente");
            if (!estadoPendiente) {
                errorResponse(res, "Error de configuracion: estado 'pendiente' no encontrado", 500);
                return;
            }

            conversacion = await guardarConversacion({
                usuario1: { connect: { id_usuario: idUsuario } },
                usuario2: { connect: { id_usuario: id_usuario_2 } },
                estadoRel: { connect: { id_estado: estadoPendiente.id_estado } },
            });
            conversacionNueva = true;
        }

        if (id_publicacion) {
            await registrarContextoConversacion(
                conversacion.id_conversacion,
                id_publicacion,
                idUsuario
            );
        }

        // Una conversación ya existente nunca puede volver a recibir el
        // "mensaje inicial". Solo la recién creada puede guardar ese único
        // mensaje mientras está pendiente; las pendientes y bloqueadas deben
        // aceptarse primero antes de admitir mensajes posteriores.
        if (!conversacionNueva) {
            const estadoActivo = await obtenerEstadoPorNombre("activo");
            if (!estadoActivo) {
                errorResponse(res, "Error de configuracion: estado 'activo' no encontrado", 500);
                return;
            }
            if (conversacion.estado_conversacion !== estadoActivo.id_estado) {
                errorResponse(res, "La conversación debe estar activa para enviar mensajes", 400);
                return;
            }
        }

        const nuevoMensaje = conversacionNueva
            ? await crearMensajeYNotificar(conversacion.id_conversacion, idUsuario, mensaje, {
                permitirMensajeInicialPendiente: true,
            })
            : await crearMensajeYNotificar(conversacion.id_conversacion, idUsuario, mensaje);

        const conversacionCompleta = await buscarConversacionCompletaPorId(conversacion.id_conversacion);
        if (!conversacionCompleta) {
            errorResponse(res, "Conversacion no encontrada", 404);
            return;
        }

        exitoResponse(res, { conversacion: conversacionCompleta, mensaje: nuevoMensaje }, "Mensaje enviado exitosamente", 201);
    } catch (error) {
        next(error);
    }
}

/*
    Lista los mensajes de una conversación, ordenados cronológicamente.
    Solo puede verlos alguno de los dos participantes.
*/
export async function obtenerMensajesDeConversacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idConversacion = Number(req.params.id);
        const idUsuario = Number(req.usuario?.sub);

        if (isNaN(idConversacion)) {
            errorResponse(res, "El ID de la conversacion no es valido", 400);
            return;
        }

        const conversacion = await buscarConversacionPorId(idConversacion);
        if (!conversacion) {
            errorResponse(res, "Conversacion no encontrada", 404);
            return;
        }

        if (conversacion.id_usuario_1 !== idUsuario && conversacion.id_usuario_2 !== idUsuario) {
            errorResponse(res, "No tienes permiso para ver esta conversacion", 403);
            return;
        }

        const mensajes = await buscarMensajesPorConversacion(idConversacion);

        exitoResponse(res, mensajes, "Mensajes obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}
