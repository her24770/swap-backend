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
    obtenerPublicacionesPorFiltros,
    obtenerPublicacionesDestacadas

} from "../controlador/controlPublicacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import { uploadImagen } from "../servicios/middlewareMulter.js";
import { schemaCrearPublicacion, schemaEditarPublicacion, schemaDestacarPublicacion, schemaFiltrosPublicacion } from "../modelo/schemaPublicacion.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { moderarTexto } from "../autenticacion/middlewareModeracion.js";
import { marcarObsoleto } from "./compatibilidad.js";
import { moderarImagenes } from "../autenticacion/middlewareModeracion.js";

const router = Router();

router.post("/buscar", autenticar, validar(schemaFiltrosPublicacion), obtenerPublicacionesPorFiltros);
router.get("/user/:id", autenticar, obtenerPublicacionesUsuario);
router.get("/", autenticar, obtenerTodasLasPublicaciones);
router.get("/:id", autenticar, obtenerPublicacionPorId);
router.post("/", autenticar, soloUsuario, uploadImagen.any(), validar(schemaCrearPublicacion), moderarTexto(['titulo', 'descripcion']), moderarImagenes, crearPublicacionConImagen);
router.patch("/:id", autenticar, soloUsuario, uploadImagen.any(), validar(schemaEditarPublicacion), moderarTexto(['titulo', 'descripcion']), moderarImagenes, editarPublicacion);
router.put("/:id", marcarObsoleto("/api/v1/publicacion/:id"), autenticar, soloUsuario, uploadImagen.any(), validar(schemaEditarPublicacion), moderarTexto(['titulo', 'descripcion']), moderarImagenes, editarPublicacion);
router.patch("/:id/estado", autenticar, soloUsuario, cambiarEstadoPublicacion);
router.delete("/:id", autenticar, soloUsuario, eliminarPublicacionConImagenes);
router.patch("/:id/destacar", autenticar, soloUsuario, validar(schemaDestacarPublicacion), destacarPublicacion);
router.get("/destacadas/user/:id", autenticar, obtenerPublicacionesDestacadas);

export default router;
