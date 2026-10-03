import { Router } from "express";
import { obtenerTodosLosEstados } from "../controlador/controlEstado.js";

const router = Router();

router.get("/", obtenerTodosLosEstados);

export default router;