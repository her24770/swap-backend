import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import {
    registrarNuevaResena,
    modificarResenaUsuario,
    obtenerResenasPerfil
} from "../controlador/controlResena";

const router = Router();

router.post("/", autenticar, soloUsuario, registrarNuevaResena);
router.put("/:id_resena", autenticar, soloUsuario, modificarResenaUsuario);
router.get("/usuario/:id_usuario", obtenerResenasPerfil);

export default router;