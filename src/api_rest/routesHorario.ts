import { Router } from "express";
import {
    actualizarHorarioUsuario,
    obtenerHorarioUsuario,
} from "../controlador/controlHorario.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import {
    autenticar,
    verificarPropietario,
} from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import { schemaActualizarHorario } from "../modelo/schemaDisponibilidad.js";

const router = Router();

router.get("/:usuarioId", obtenerHorarioUsuario);
router.put(
    "/:usuarioId",
    autenticar,
    verificarPropietario,
    soloUsuario,
    validar(schemaActualizarHorario),
    actualizarHorarioUsuario
);

export default router;
