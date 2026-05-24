import { Router } from "express";
import { obtenerEtiquetasUsuario, obtenerEtiquetasPublicacion, obtenerEtiquetas, sincronizarEtiquetasUsuarioController } from "../controlador/controlEtiquetas";
import { validar } from "../autenticacion/middelwareValidacion";
import { autenticar, verificarPropietario } from "../autenticacion/GestorPermisos";
import { schemaSincronizarEtiquetas } from "../modelo/schemaEtiqueta";

const router = Router();

router.get("/user/:id", autenticar, obtenerEtiquetasUsuario); //Ruta para las etiquetas asignadas a un usuario
router.get("/publicacion/:id", autenticar, obtenerEtiquetasPublicacion); //Ruta para las etiquetas asignadas a una publicacion
router.get("/", obtenerEtiquetas);
router.post("/user/:id", autenticar, verificarPropietario, validar(schemaSincronizarEtiquetas), sincronizarEtiquetasUsuarioController); //Ruta para sincronizar las etiquetas de un usuario

export default router;
