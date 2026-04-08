import { Router } from "express";
import { obtenerPublicacionesUsuario } from "../controlador/controlPublicacion.js";

const router = Router();

router.get("/user/:id", obtenerPublicacionesUsuario);

export default router;