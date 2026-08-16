import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import { registrarNuevoReporte } from "../controlador/controlReporte";

const router = Router();

// Reportar es una accion exclusiva de Usuario -- el panel de moderador
// resuelve reportes, no los crea.
router.post("/", autenticar, soloUsuario, registrarNuevoReporte);

export default router;
