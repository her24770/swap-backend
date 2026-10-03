import { Router } from "express";
import { listarNotificaciones, cambiarEstadoNotificacion } from "../controlador/controlNotificacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";

const router = Router();

// Notificaciones es exclusivo de Usuario -- el panel de moderador no lo usa.
router.use(autenticar, soloUsuario);

router.get("/", autenticar, listarNotificaciones);
router.patch("/:id/estado", autenticar, cambiarEstadoNotificacion);

export default router;
