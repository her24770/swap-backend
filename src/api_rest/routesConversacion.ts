import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { actualizarEstadoConversacion } from "../controlador/controlConversacion.js";

const router = Router();

router.put("/:id/estado", autenticar, actualizarEstadoConversacion); //Ruta para bloquear o aceptar la solicitud de conversacion

export default router;