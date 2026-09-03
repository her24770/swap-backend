import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaActualizarEstadoConversacion, schemaIniciarConversacion } from "../modelo/schemaMensaje.js";
import {
    actualizarEstadoConversacion,
    obtenerConversacionesDeUsuario,
    iniciarConversacion,
    obtenerMensajesDeConversacion,
} from "../controlador/controlConversacion.js";

const router = Router();

// El chat es exclusivo de Usuario -- el panel de moderador no lo usa.
router.use(autenticar, soloUsuario);

router.put("/:id/estado", autenticar, validar(schemaActualizarEstadoConversacion), actualizarEstadoConversacion) //Ruta para bloquear o aceptar la solicitud de conversacion
router.get("/conversaciones", autenticar, obtenerConversacionesDeUsuario)
router.post("/", autenticar, validar(schemaIniciarConversacion), iniciarConversacion) //Crea la conversacion si no existe y envia el primer mensaje
router.get("/:id/mensajes", autenticar, obtenerMensajesDeConversacion) //Historial de mensajes de una conversacion

export default router;
