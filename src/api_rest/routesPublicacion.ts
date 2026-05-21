import { Router } from "express";
import {
    obtenerPublicacionesUsuario,
    obtenerTodasLasPublicaciones,
    crearPublicacionConImagen,
    agregarOActualizarImagen,
    editarPublicacion,
    cambiarEstadoPublicacion,
    obtenerPublicacionPorId,
    eliminarPublicacionConImagenes,
    obtenerPublicacionesGuardadas,
    guardarPublicacionAutenticada,
    eliminarGuardadoPublicacion
} from "../controlador/controlPublicacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { uploadImagen } from "../servicios/middlewareMulter.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaEditarPublicacion } from "../modelo/schemaPublicacion.js";

const router = Router();

router.get("/user/:id", autenticar, obtenerPublicacionesUsuario);
router.get("/guardadas", autenticar, obtenerPublicacionesGuardadas);
router.get("/", autenticar, obtenerTodasLasPublicaciones);
router.get("/:id", autenticar, obtenerPublicacionPorId);
router.post("/", autenticar, uploadImagen.single('imagen'), crearPublicacionConImagen);
router.post("/:id/guardar", autenticar, guardarPublicacionAutenticada);
router.put("/:id/imagen", autenticar, uploadImagen.single('imagen'), agregarOActualizarImagen);
router.put("/:id", autenticar, validar(schemaEditarPublicacion), editarPublicacion)
router.patch("/:id/estado", autenticar, cambiarEstadoPublicacion)
router.delete("/:id/guardar", autenticar, eliminarGuardadoPublicacion)
router.delete("/:id", autenticar, eliminarPublicacionConImagenes)

export default router;
