import { Router } from "express";
import { listarNotificaciones, cambiarEstadoNotificacion } from "../controlador/controlNotificacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";

const router = Router();

router.get("/", autenticar, listarNotificaciones);
router.patch("/:id/estado", autenticar, cambiarEstadoNotificacion);

export default router;
