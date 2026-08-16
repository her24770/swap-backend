import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import {
    registrarNuevaResena,
    modificarResenaUsuario,
    obtenerResenasPerfil,
    eliminarResenaUsuario
} from "../controlador/controlResena";

const router = Router();

router.post("/", autenticar, soloUsuario, registrarNuevaResena);
router.put("/:id_resena", autenticar, soloUsuario, modificarResenaUsuario);
router.get("/usuario/:id_usuario", obtenerResenasPerfil);
router.delete("/:id_resena", autenticar, soloUsuario, eliminarResenaUsuario);

export default router;