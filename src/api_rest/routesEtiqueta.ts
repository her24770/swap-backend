import { Router } from "express";
import { obtenerEtiquetasUsuario, obtenerEtiquetasPublicacion, obtenerEtiquetas } from "../controlador/controlEtiquetas";
import { autenticar } from "../autenticacion/GestorPermisos";

const router = Router();

router.get("/user/:id", autenticar, obtenerEtiquetasUsuario); //Ruta para las etiquetas asignadas a un usuario
router.get("/publicacion/:id", autenticar, obtenerEtiquetasPublicacion); //Ruta para las etiquetas asignadas a una publicacion
router.get("/", autenticar, obtenerEtiquetas);

export default router;
