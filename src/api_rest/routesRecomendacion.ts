import { Router } from "express";
import { obtenerRecomendacionesGlobales } from "../controlador/controlRecomendacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";

const router = Router();

router.get("/globales/:tipo?", autenticar, obtenerRecomendacionesGlobales);

export default router;