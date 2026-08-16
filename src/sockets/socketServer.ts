import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { ServicioJWT, TokenVerificado } from "../autenticacion/ServicioJWT.js";
import { estaRevocado } from "../autenticacion/blacklist.js";
import { buscarConversacionPorId } from "../repository/repositorioMensaje.js";
import { schemaEnviarMensaje } from "../modelo/schemaMensaje.js";
import { crearMensajeYNotificar } from "../servicios/servicioMensajeria.js";
import { setIO } from "./ioInstance.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";

interface AckRespuesta {
    success: boolean;
    message?: string;
    data?: unknown;
}

/**
 * Parser manual de cookies del header crudo del handshake de socket.io.
 * No se reutiliza cookie-parser porque solo corre como middleware de Express
 * y socket.io no pasa por ese pipeline aunque comparta el mismo httpServer.
 * La cookie "swap-token" no va firmada, así que no hace falta un secreto.
 */
function parseCookies(header?: string): Record<string, string> {
    const resultado: Record<string, string> = {};
    if (!header) return resultado;

    header.split(";").forEach((par) => {
        const idx = par.indexOf("=");
        if (idx === -1) return;
        const clave = par.slice(0, idx).trim();
        const valor = par.slice(idx + 1).trim();
        if (!clave) return;
        try {
            resultado[clave] = decodeURIComponent(valor);
        } catch {
            resultado[clave] = valor;
        }
    });

    return resultado;
}

async function autenticarSocket(socket: Socket, next: (err?: Error) => void): Promise<void> {
    try {
        const cookies = parseCookies(socket.handshake.headers.cookie);
        const token = cookies["swap-token"];

        if (!token) {
            next(new Error("Token de autenticación requerido."));
            return;
        }

        const revocado = await estaRevocado(token);
        if (revocado) {
            next(new Error("Sesión cerrada. Por favor inicia sesión nuevamente."));
            return;
        }

        const usuario: TokenVerificado = ServicioJWT.verificarToken(token);

        // El chat/notificaciones en tiempo real son exclusivos de Usuario.
        // Sin esto, un moderador cuyo id_moderador coincida numericamente
        // con un id_usuario real se uniria a la sala personal de ese
        // usuario ("usuario:<sub>") y recibiria sus notificaciones/mensajes.
        if (usuario.rol !== "usuario") {
            next(new Error("Los sockets son exclusivos de sesiones de usuario."));
            return;
        }

        socket.data.usuario = usuario;
        next();
    } catch (error) {
        const mensaje = error instanceof Error ? error.message : "Token inválido.";
        next(new Error(mensaje));
    }
}

export function initSocketServer(httpServer: HttpServer): Server {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            credentials: true,
        },
    });

    io.use(autenticarSocket);

    io.on("connection", (socket: Socket) => {
        const idUsuario = Number(socket.data.usuario?.sub);

        // Sala personal: recibe notificaciones y avisos aunque no tenga ningún chat abierto.
        socket.join(`usuario:${idUsuario}`);

        socket.on(
            "conversacion:unirse",
            async (idConversacion: number, callback?: (respuesta: AckRespuesta) => void) => {
                try {
                    const conversacion = await buscarConversacionPorId(Number(idConversacion));
                    if (!conversacion) {
                        callback?.({ success: false, message: "Conversación no encontrada" });
                        return;
                    }
                    if (conversacion.id_usuario_1 !== idUsuario && conversacion.id_usuario_2 !== idUsuario) {
                        callback?.({ success: false, message: "No tienes permiso para unirte a esta conversación" });
                        return;
                    }
                    const estadoActivo = await obtenerEstadoPorNombre("activo");
                    if (!estadoActivo) {
                        callback?.({
                            success: false,
                            message: "Error de configuración: estado 'activo' no encontrado",
                        });
                        return;
                    }

                    if (conversacion.estado_conversacion !== estadoActivo.id_estado) {
                        callback?.({
                            success: false,
                            message: "La conversación debe estar activa para enviar mensajes",
                        });
                        return;
                    }
                    socket.join(`conversacion:${conversacion.id_conversacion}`);
                    callback?.({ success: true });
                } catch (error) {
                    callback?.({ success: false, message: "Error al unirse a la conversación" });
                }
            }
        );

        socket.on("mensaje:enviar", async (payload: unknown, callback?: (respuesta: AckRespuesta) => void) => {
            try {
                const datos = schemaEnviarMensaje.parse(payload);
                const conversacion = await buscarConversacionPorId(datos.id_conversacion);

                if (!conversacion) {
                    callback?.({ success: false, message: "Conversación no encontrada" });
                    return;
                }
                if (conversacion.id_usuario_1 !== idUsuario && conversacion.id_usuario_2 !== idUsuario) {
                    callback?.({
                        success: false,
                        message: "No tienes permiso para enviar mensajes en esta conversación",
                    });
                    return;
                }

                const mensaje = await crearMensajeYNotificar(datos.id_conversacion, idUsuario, datos.mensaje);
                callback?.({ success: true, data: mensaje });
            } catch (error) {
                const mensaje = error instanceof Error ? error.message : "Error al enviar el mensaje";
                callback?.({ success: false, message: mensaje });
            }
        });
    });

    setIO(io);
    return io;
}
