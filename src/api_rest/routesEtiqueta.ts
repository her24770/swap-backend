import { Router } from "express";
import { obtenerEtiquetasUsuario, obtenerEtiquetas } from "../controlador/controlEtiquetas";
import { autenticar } from "../autenticacion/GestorPermisos";

const router = Router();

router.get("/", autenticar, obtenerEtiquetas);
router.get("/user/:id", autenticar, obtenerEtiquetasUsuario);

export default router;
