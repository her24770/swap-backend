import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloModerador } from "../autenticacion/permisosModerador.js";
import { listarUsuariosModeracion } from "../controlador/controlModeracionUsuario.js";

const router = Router();

router.get("/", autenticar, soloModerador, listarUsuariosModeracion);

export default router;