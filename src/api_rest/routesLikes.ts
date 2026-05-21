import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos";
import { like, unlike } from "../controlador/controlLikes";

const router = Router();

router.post("/:publicacionId", autenticar, like);
router.delete("/:publicacionId", autenticar, unlike);

export default router;