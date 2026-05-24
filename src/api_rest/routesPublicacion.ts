import { Router } from "express";
import {
    obtenerPublicacionesUsuario,
    obtenerTodasLasPublicaciones,
    crearPublicacionConImagen,
    editarPublicacion,
    cambiarEstadoPublicacion,
    obtenerPublicacionPorId,
    eliminarPublicacionConImagenes,
    destacarPublicacion,
    destacarPublicacion
} from "../controlador/controlPublicacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { uploadImagen } from "../servicios/middlewareMulter.js";
import { schemaDestacarPublicacion } from "../modelo/schemaPublicacion.js";

const router = Router();

router.get("/user/:id", autenticar, obtenerPublicacionesUsuario);
router.get("/", autenticar, obtenerTodasLasPublicaciones);
router.get("/:id", autenticar, obtenerPublicacionPorId);
router.post("/", autenticar, uploadImagen.any(), crearPublicacionConImagen);
router.put("/:id", autenticar, uploadImagen.any(), editarPublicacion);
router.patch("/:id/estado", autenticar, cambiarEstadoPublicacion);
router.delete("/:id", autenticar, eliminarPublicacionConImagenes);
router.patch("/:id/destacar", autenticar, validar(schemaDestacarPublicacion), destacarPublicacion);

export default router;
