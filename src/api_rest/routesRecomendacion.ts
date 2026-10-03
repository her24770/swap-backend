import { Router } from "express";
import {
    obtenerRecomendacionesGlobales,
    obtenerRecomendacionesTutores,
    obtenerRecomendacionesPersonalizadas,
    obtenerRecomendacionesMias,
    obtenerSimilares,
    registrarEventoUsuario,
    agregarFavoritas,
    eliminarFavoritas,
} from "../controlador/controlRecomendacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";

const router = Router();

router.get("/globales/:tipo?",  autenticar, obtenerRecomendacionesGlobales);
router.get("/tutores",   autenticar, obtenerRecomendacionesTutores);
router.get("/personalizadas",   autenticar, soloUsuario, obtenerRecomendacionesPersonalizadas);
router.get("/mias",             autenticar, soloUsuario, obtenerRecomendacionesMias);
router.get("/similares/:id",    autenticar, obtenerSimilares);
router.post("/evento",          autenticar, soloUsuario, registrarEventoUsuario);
router.post("/favoritas",       autenticar, soloUsuario, agregarFavoritas);
router.delete("/favoritas",     autenticar, soloUsuario, eliminarFavoritas);

export default router;