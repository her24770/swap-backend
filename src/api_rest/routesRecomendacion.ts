import { Router } from "express";
import {
    obtenerRecomendacionesGlobales,
    obtenerRecomendacionesPersonalizadas,
    obtenerRecomendacionesMias,
    obtenerSimilares,
    registrarEventoUsuario,
    agregarFavoritas,
    eliminarFavoritas,
} from "../controlador/controlRecomendacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";

const router = Router();

router.get("/globales/:tipo?",  autenticar, obtenerRecomendacionesGlobales);
router.get("/personalizadas",   autenticar, obtenerRecomendacionesPersonalizadas);
router.get("/mias",             autenticar, obtenerRecomendacionesMias);
router.get("/similares/:id",    autenticar, obtenerSimilares);
router.post("/evento",          autenticar, registrarEventoUsuario);
router.post("/favoritas",       autenticar, agregarFavoritas);
router.delete("/favoritas",     autenticar, eliminarFavoritas);

export default router;