import { Router } from "express";
import { buscarPublicacionesSemanticamente } from "../controlador/controlBusqueda.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";

const router = Router();

router.get("/", autenticar, buscarPublicacionesSemanticamente);

export default router;
