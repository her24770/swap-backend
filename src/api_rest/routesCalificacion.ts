import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { 
    registrarCalificacion, 
    editarCalificacionUsuario, 
    obtenerCalificacionesDeUsuario 
} from "../controlador/controlCalificacion"; 

const router = Router();

router.post("/", autenticar, registrarCalificacion);
router.put("/:id_calificacion", autenticar, editarCalificacionUsuario);
router.get("/usuario/:id_usuario", obtenerCalificacionesDeUsuario);

export default router;