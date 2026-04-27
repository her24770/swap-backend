import { Router } from "express";
import { obtenerEtiquetasUsuario } from "../controlador/controlEtiquetas";
import { autenticar } from "../autenticacion/GestorPermisos";

const router = Router();

router.get("/user/:id", autenticar, obtenerEtiquetasUsuario); //Ruta para las etiquetas asignadas a un usuario

export default router;
