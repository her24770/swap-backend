import { Router } from "express";
import { obtenerPublicacionesUsuario, obtenerTodasLasPublicaciones, crearPublicacionConImagen, agregarOActualizarImagen, editarPublicacion } from "../controlador/controlPublicacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { uploadImagen } from "../servicios/middlewareMulter.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaEditarPublicacion } from "../modelo/schemaPublicacion.js";

const router = Router();

router.get("/user/:id", autenticar, obtenerPublicacionesUsuario);
router.get("/", autenticar, obtenerTodasLasPublicaciones);
router.post("/", autenticar, uploadImagen.single('imagen'), crearPublicacionConImagen);
router.put("/:id/imagen", autenticar, uploadImagen.single('imagen'), agregarOActualizarImagen);
router.patch("/:id", autenticar, validar(schemaEditarPublicacion), editarPublicacion)

export default router;