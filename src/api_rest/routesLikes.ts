import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos";
import { soloUsuario } from "../autenticacion/permisosUsuario";
import { like, unlike } from "../controlador/controlLikes";

const router = Router();

// Likes es exclusivo de Usuario -- el panel de moderador no lo usa.
router.use(autenticar, soloUsuario);

router.post("/:publicacionId", autenticar, like);
router.delete("/:publicacionId", autenticar, unlike);

export default router;