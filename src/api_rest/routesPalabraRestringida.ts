import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloModerador } from "../autenticacion/permisosModerador.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaCrearPalabraRestringida, schemaEditarPalabraRestringida } from "../modelo/schemaPalabraRestringida.js";
import {
    listarPalabrasRestringidas,
    crearPalabraRestringidaController,
    editarPalabraRestringidaController,
    eliminarPalabraRestringidaController,
} from "../controlador/controlPalabraRestringida.js";

const router = Router();

router.get("/", autenticar, soloModerador, listarPalabrasRestringidas);
router.post("/", autenticar, soloModerador, validar(schemaCrearPalabraRestringida), crearPalabraRestringidaController);
router.patch("/:id", autenticar, soloModerador, validar(schemaEditarPalabraRestringida), editarPalabraRestringidaController);
router.delete("/:id", autenticar, soloModerador, eliminarPalabraRestringidaController);

export default router;