import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { 
    registrarNuevaResena, 
    modificarResenaUsuario, 
    obtenerResenasPerfil 
} from "../controlador/controlResena";

const router = Router();

router.post("/", autenticar, registrarNuevaResena);
router.put("/:id_resena", autenticar, modificarResenaUsuario);
router.get("/usuario/:id_usuario", obtenerResenasPerfil);

export default router;