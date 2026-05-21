import { Router } from "express";
import {
    actualizarHorarioUsuario,
    obtenerHorarioUsuario,
} from "../controlador/controlHorario.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import {
    autenticar,
    gestorPermisos,
    verificarPropietario,
} from "../autenticacion/GestorPermisos.js";
import { schemaActualizarHorario } from "../modelo/schemaDisponibilidad.js";

const router = Router();

router.get("/:usuarioId", obtenerHorarioUsuario);
router.put(
    "/:usuarioId",
    autenticar,
    verificarPropietario,
    gestorPermisos("usuario", "moderador"),
    validar(schemaActualizarHorario),
    actualizarHorarioUsuario
);

export default router;
