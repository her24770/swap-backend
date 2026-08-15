import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { 
    registrarNuevaResena, 
    modificarResenaUsuario, 
    obtenerResenasPerfil,
    eliminarResenaUsuario 
} from "../controlador/controlResena";

const router = Router();

router.post("/", autenticar, registrarNuevaResena);
router.put("/:id_resena", autenticar, modificarResenaUsuario);
router.get("/usuario/:id_usuario", obtenerResenasPerfil);
router.delete("/:id_resena", autenticar, eliminarResenaUsuario);

export default router;