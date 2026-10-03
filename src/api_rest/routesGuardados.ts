import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos";
import { soloUsuario } from "../autenticacion/permisosUsuario";
import { guardar, quitarGuardado, obtenerGuardados } from "../controlador/controlGuardados";

const router = Router();

// Guardados es exclusivo de Usuario -- el panel de moderador no lo usa.
router.use(autenticar, soloUsuario);

router.get("/", autenticar, obtenerGuardados);
router.post("/:publicacionId", autenticar, guardar);
router.delete("/:publicacionId", autenticar, quitarGuardado);

export default router;