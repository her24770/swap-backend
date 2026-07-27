import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaIniciarConversacion } from "../modelo/schemaMensaje.js";
import {
    actualizarEstadoConversacion,
    obtenerConversacionesDeUsuario,
    iniciarConversacion,
    obtenerMensajesDeConversacion,
} from "../controlador/controlConversacion.js";

const router = Router();

router.put("/:id/estado", autenticar, actualizarEstadoConversacion) //Ruta para bloquear o aceptar la solicitud de conversacion
router.get("/conversaciones", autenticar, obtenerConversacionesDeUsuario)
router.post("/", autenticar, validar(schemaIniciarConversacion), iniciarConversacion) //Crea la conversacion si no existe y envia el primer mensaje
router.get("/:id/mensajes", autenticar, obtenerMensajesDeConversacion) //Historial de mensajes de una conversacion

export default router;