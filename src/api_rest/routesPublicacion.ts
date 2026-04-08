import { Router } from "express";
import { obtenerPublicacionesUsuario, obtenerTodasLasPublicaciones } from "../controlador/controlPublicacion.js";

const router = Router();

router.get("/user/:id", obtenerPublicacionesUsuario);
router.get("/", obtenerTodasLasPublicaciones);

export default router;