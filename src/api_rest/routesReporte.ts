import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { registrarNuevoReporte } from "../controlador/controlReporte";

const router = Router();

router.post("/", autenticar, registrarNuevoReporte);

export default router;
