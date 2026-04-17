import { Router } from "express";
import { obtenerPublicacionesUsuario, obtenerTodasLasPublicaciones } from "../controlador/controlPublicacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";

const router = Router();

router.get("/user/:id", autenticar, obtenerPublicacionesUsuario);
router.get("/", autenticar, obtenerTodasLasPublicaciones);

export default router;