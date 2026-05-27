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
    obtenerPublicacionesPorFiltros
} from "../controlador/controlPublicacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { uploadImagen } from "../servicios/middlewareMulter.js";
import { schemaDestacarPublicacion, schemaFiltrosPublicacion } from "../modelo/schemaPublicacion.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { moderarTexto } from "../autenticacion/middlewareModeracion.js";

const router = Router();

router.post("/buscar", autenticar, validar(schemaFiltrosPublicacion), obtenerPublicacionesPorFiltros);
router.get("/user/:id", autenticar, obtenerPublicacionesUsuario);
router.get("/", autenticar, obtenerTodasLasPublicaciones);
router.get("/:id", autenticar, obtenerPublicacionPorId);
router.post("/", autenticar, uploadImagen.any(), moderarTexto(['titulo', 'descripcion']), crearPublicacionConImagen);
router.put("/:id", autenticar, uploadImagen.any(), moderarTexto(['titulo', 'descripcion']), editarPublicacion);
router.patch("/:id/estado", autenticar, cambiarEstadoPublicacion);
router.delete("/:id", autenticar, eliminarPublicacionConImagenes);
router.patch("/:id/destacar", autenticar, validar(schemaDestacarPublicacion), destacarPublicacion);

export default router;
