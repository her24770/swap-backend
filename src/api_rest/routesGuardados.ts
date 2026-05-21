import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos";
import { guardar, quitarGuardado, obtenerGuardados } from "../controlador/controlGuardados";

const router = Router();

router.get("/", autenticar, obtenerGuardados);
router.post("/:publicacionId", autenticar, guardar);
router.delete("/:publicacionId", autenticar, quitarGuardado);

export default router;